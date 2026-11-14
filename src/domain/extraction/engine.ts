import type { Ingredient, Product } from '../types';
import { normalizeIdentifier, validGTIN } from '../identifiers';
import { decodeScan } from '../scan';
import { parseGS1 } from '../gs1';
import { tokenize } from './formats';
import { chronologyError, readDate } from './dates';
import {
  formOf,
  ingredientsOf,
  labelField,
  nameOf,
  nameSimilarity,
  normalizeName,
  strengthOf,
} from './text';
import {
  emptyFields,
  packageKeys,
  missing,
  evidence,
  fieldKeys,
  type Candidate,
  type ExtractedField,
  type Extraction,
  type ExtractionContext,
  type FieldKey,
  type Fields,
  type Method,
  type Token,
} from './types';

export function assign(
  result: Extraction,
  key: FieldKey,
  field: ExtractedField<string | Ingredient[]>,
) {
  result.fields = { ...result.fields, [key]: field } as Fields;
}
export function tokenValue(key: FieldKey, raw: string): string | Ingredient[] | null {
  if (key === 'activeIngredients') return ingredientsOf(raw);
  if (key === 'productName') return nameOf(raw);
  if (key === 'manufacturingDate' || key === 'expiryDate') return readDate(raw).value;
  if (key === 'strength') return strengthOf(raw) ?? (raw.trim().length <= 80 ? raw.trim() : null);
  if (key === 'dosageForm') return raw.trim().length <= 80 ? raw.trim() : null;
  if (key === 'gtin') {
    if (/^\d+$/.test(raw.trim()) && !validGTIN(raw.trim())) return null;
    return raw.trim().length <= 256 && !/[\n\r<>]|^[a-z][a-z0-9+.-]*:/i.test(raw.trim())
      ? normalizeIdentifier(raw.trim())
      : null;
  }
  return raw.trim().length <= 512 ? raw.trim() || null : null;
}
export function applyToken(
  result: Extraction,
  key: FieldKey,
  token: Token,
  method: Method,
  confidence: 'high' | 'medium' | 'low' = 'medium',
) {
  const value = tokenValue(key, token.raw);
  if (value === null) {
    if (key === 'manufacturingDate' || key === 'expiryDate')
      result.issues.push(readDate(token.raw).issue!);
    else
      result.issues.push(`The ${key} field could not be validated. Check the original packaging.`);
    return;
  }
  if (result.fields[key].value !== null) {
    if (JSON.stringify(result.fields[key].value) !== JSON.stringify(value))
      result.issues.push(`Conflicting values were found for ${key}. Confirm the intended value.`);
    return;
  }
  assign(result, key, evidence(value, token.raw, method, token.locator, confidence));
  if (key === 'productName') {
    const strength = strengthOf(token.raw),
      form = formOf(token.raw);
    if (strength && result.fields.strength.value === null)
      assign(result, 'strength', evidence(strength, token.raw, method, token.locator, confidence));
    if (form && result.fields.dosageForm.value === null)
      assign(result, 'dosageForm', evidence(form, token.raw, method, token.locator, confidence));
  }
}
export function catalogFields(product: Product): Partial<Fields> {
  const values: Partial<Record<FieldKey, string | Ingredient[]>> = {
    productName: product.name,
    strength: product.strength,
    dosageForm: product.dosage_form,
    activeIngredients: product.ingredients.length ? product.ingredients : undefined,
    manufacturer: product.manufacturer,
    manufacturerAddress: product.manufacturer_address,
  };
  const fields: Partial<Fields> = {};
  for (const [key, value] of Object.entries(values))
    if (value) {
      Object.assign(fields, {
        [key]: {
          ...evidence(value, null, 'database', null, 'high'),
          source: product.source || 'Local catalog',
          origin: 'catalog',
          verification: product.verification === 'source_checked' ? 'source_checked' : 'unverified',
        },
      });
    }
  return fields;
}
function candidatesFor(result: Extraction, products: Product[]): Candidate[] {
  const givenName = result.fields.productName.value,
    givenStrength = result.fields.strength.value;
  const identifier = result.fields.gtin.value;
  const candidates: Candidate[] = [];
  for (const product of products) {
    const exactCode = Boolean(identifier && product.barcodes.includes(identifier));
    let best = givenName ? nameSimilarity(givenName, product.name) : 0,
      reason = best === 1 ? 'Matching local name' : 'Similar local name';
    for (const token of givenName ? [] : result.tokens) {
      const labelledField = labelField(token.label);
      if (labelledField && labelledField !== 'productName') continue;
      const name = nameOf(token.raw);
      if (!name || token.kind === 'date' || token.kind === 'company' || token.kind === 'address')
        continue;
      const score = nameSimilarity(name, product.name);
      if (score > best) {
        best = score;
        reason = score === 1 ? 'Name found in scanned text' : 'Similar local name';
      }
    }
    if (!exactCode && best < 0.72) {
      const knownIngredients = product.ingredients.map((i) => normalizeName(i.name));
      if (
        result.fields.activeIngredients.value?.some((i) =>
          knownIngredients.includes(normalizeName(i.name)),
        )
      ) {
        best = 0.6;
        reason = 'Recorded ingredient overlap only';
      }
    }
    if (!exactCode && best < 0.6) continue;
    if (
      givenStrength &&
      product.strength &&
      givenStrength.toLowerCase().replace(/\s/g, '') !==
        product.strength.toLowerCase().replace(/\s/g, '')
    )
      best = Math.max(0, best - 0.3);
    candidates.push({
      key: `product:${product.id}`,
      productId: product.id,
      name: product.name,
      strength: product.strength || null,
      dosageForm: product.dosage_form || null,
      score: exactCode ? 1 : best,
      reason: exactCode ? 'Exact local identifier' : reason,
    });
  }
  return candidates.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, 8);
}
export function extractMedicine(
  raw: string,
  format: string,
  context: ExtractionContext,
): Extraction {
  const tokenized = tokenize(raw);
  const result: Extraction = {
    version: 1,
    raw,
    format,
    kind: tokenized.kind,
    fields: emptyFields(),
    tokens: tokenized.tokens,
    additionalInformation: [],
    candidates: [],
    predictedProductId: null,
    issues: [...tokenized.issues],
    signature: tokenized.signature,
    templateId: null,
    identityConflict: false,
  };
  if (tokenized.kind === 'unsupported') return result;
  const decoded = decodeScan(raw, format);
  const simpleIdentifier =
    decoded.identifier &&
    decoded.identifier.length <= 256 &&
    !/[\n\r;|:=]/.test(raw) &&
    result.tokens.length <= 1;
  if (simpleIdentifier) {
    result.kind = 'identifier';
    assign(result, 'gtin', evidence(decoded.identifier!, raw, 'pattern', null, 'high'));
  }
  let gs1 = decoded.kind === 'gs1' ? decoded : null;
  if (!gs1 && ['datamatrix', 'code128'].includes(format) && /^01\d{14}/.test(raw)) {
    const possible = parseGS1(raw);
    if (possible.gtin && !possible.notes.length) {
      gs1 = { ...decoded, ...possible, kind: 'gs1', identifier: possible.gtin };
      result.issues.push(
        'GS1-shaped content was detected without a symbology indicator. Confirm all package fields.',
      );
    }
  }
  if (gs1) {
    result.kind = 'gs1';
    result.issues.push(...gs1.notes);
    const values: Partial<Record<FieldKey, string>> = {
      gtin: gs1.gtin,
      batchNumber: gs1.batch,
      serialNumber: gs1.serial,
      expiryDate: gs1.expiryPrecision === 'month' ? gs1.expiry?.slice(0, 7) : gs1.expiry,
      manufacturingDate:
        gs1.manufacturingPrecision === 'month' ? gs1.manufacturing?.slice(0, 7) : gs1.manufacturing,
    };
    for (const [key, value] of Object.entries(values))
      if (value) assign(result, key as FieldKey, evidence(value, raw, 'gs1', null, 'high'));
  }
  // Standard fields have priority over manufacturer-specific labels.
  const handled = new Set<string>();
  if (!gs1)
    for (const token of result.tokens) {
      if (token.locator.startsWith('unmapped:') || token.locator.startsWith('pattern:')) continue;
      const field = labelField(token.label);
      if (field) {
        applyToken(result, field, token, 'labelled', 'high');
        handled.add(token.locator);
      }
    }
  const templates = (context.templates ?? []).filter(
    (t) =>
      t.verification === 'locally_confirmed' &&
      t.confirmations >= 2 &&
      t.signature === result.signature,
  );
  const distinctRules = new Set(templates.map((t) => JSON.stringify(t.rules)));
  if (distinctRules.size > 1)
    result.issues.push('Conflicting local format templates were ignored. Confirm fields manually.');
  else if (templates.length) {
    const template = templates[0];
    const valid = template.rules.every(
      (rule) =>
        fieldKeys.includes(rule.field) &&
        result.tokens.filter((t) => t.locator === rule.locator).length === 1 &&
        !rule.locator.startsWith('unmapped:'),
    );
    if (valid) {
      result.templateId = template.id;
      for (const rule of template.rules) {
        const token = result.tokens.find((t) => t.locator === rule.locator)!;
        if (result.fields[rule.field].value === null)
          applyToken(result, rule.field, token, 'template', 'medium');
      }
      result.issues.push(
        'A locally confirmed format helped identify fields. Each new pack still needs checking.',
      );
    }
  }
  const unlabelled = (
    result.kind === 'gs1' ||
    ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'].includes(format) ||
    (result.kind === 'identifier' && !strengthOf(raw) && !/\s/.test(raw))
      ? []
      : result.tokens
  ).filter((t) => t.locator.startsWith('pattern:') || t.locator.startsWith('unmapped:'));
  const ingredientNames = [
    ...new Set(context.products.flatMap((p) => p.ingredients.map((i) => normalizeName(i.name)))),
  ];
  const ingredientTokens = unlabelled.filter((t) =>
    ingredientNames.some((name) => name && normalizeName(nameOf(t.raw) ?? '') === name),
  );
  if (result.fields.activeIngredients.value === null && ingredientTokens.length) {
    const ingredients = ingredientTokens.flatMap((t) => ingredientsOf(t.raw) ?? []);
    if (ingredients.length)
      assign(
        result,
        'activeIngredients',
        evidence(
          ingredients,
          ingredientTokens.map((t) => t.raw).join('\n'),
          'pattern',
          ingredientTokens.length === 1 ? ingredientTokens[0].locator : null,
          'low',
        ),
      );
  }
  const names = unlabelled.filter(
    (t) =>
      ['text', 'strength_text'].includes(t.kind) &&
      !ingredientTokens.includes(t) &&
      nameOf(t.raw) &&
      !/[<>{}]|\b(?:ignore instructions|system prompt|drop table|select .+ from)\b/i.test(t.raw),
  );
  if (result.fields.productName.value === null && names.length === 1)
    applyToken(result, 'productName', names[0], 'pattern', 'low');
  if (result.fields.productName.value === null && names.length > 1)
    result.issues.push(
      'Several unlabelled lines could be medicine names. Select or enter the correct identity.',
    );
  for (const [kind, field] of [
    ['company', 'manufacturer'],
    ['address', 'manufacturerAddress'],
    ['code', 'batchNumber'],
  ] as const) {
    const tokens = unlabelled.filter((t) => t.kind === kind);
    if (tokens.length === 1 && result.fields[field].value === null) {
      applyToken(result, field, tokens[0], 'pattern', 'low');
      if (kind === 'code')
        result.issues.push(
          'An unlabelled code was suggested as a batch number; it could be a serial or another identifier.',
        );
    }
  }
  if (unlabelled.some((t) => t.kind === 'date'))
    result.issues.push(
      'Unlabelled dates were not assigned to manufacturing or expiry. Set their meanings after checking the package.',
    );
  result.candidates = candidatesFor(result, context.products);
  const best = result.candidates[0],
    second = result.candidates[1];
  const exactCode = best?.reason === 'Exact local identifier';
  const decisive =
    best && (exactCode || (best.score >= 0.8 && (!second || best.score - second.score >= 0.12)));
  if (decisive) {
    const product = context.products.find((p) => p.id === best.productId)!;
    const labelledName = result.fields.productName;
    const differentName =
      labelledName.value && nameSimilarity(labelledName.value, product.name) < 0.72;
    const differentStrength =
      result.fields.strength.value &&
      product.strength &&
      result.fields.strength.value.toLowerCase().replace(/\s/g, '') !==
        product.strength.toLowerCase().replace(/\s/g, '');
    if (exactCode && (differentName || differentStrength)) {
      result.identityConflict = true;
      result.issues.push(
        'The encoded identifier and printed identity fields disagree. Check the name and strength carefully.',
      );
      // Do not attach the conflicting payload's product-specific attributes to the identifier's product.
      for (const key of ['activeIngredients', 'manufacturer', 'manufacturerAddress'] as const)
        assign(result, key, missing());
    }
    result.predictedProductId = product.id;
    const fromCatalog = catalogFields(product);
    result.fields = { ...result.fields, ...fromCatalog };
    if (!exactCode) {
      result.fields.productName = {
        ...result.fields.productName,
        method: best.score === 1 ? 'database' : 'fuzzy',
        confidence: best.score === 1 ? 'high' : 'low',
      };
      // The payload's attributes can be reviewed only when its identity is consistent.
      if (labelledName.value && !differentName && !differentStrength)
        for (const key of ['activeIngredients', 'manufacturer', 'manufacturerAddress'] as const) {
          const token = result.tokens.find((t) => labelField(t.label) === key);
          if (token) {
            assign(result, key, missing());
            applyToken(result, key, token, 'labelled', 'high');
          }
        }
    }
  }
  const previous = context.previous;
  const previousProduct = previous?.productId
    ? context.products.find((p) => p.id === previous.productId)
    : null;
  const exactReviewedPayload =
    previous &&
    previous.extraction.raw === raw &&
    previous.extraction.format === format &&
    previousProduct &&
    normalizeName(previous.extraction.fields.productName.value ?? '') ===
      normalizeName(previousProduct.name) &&
    (previous.extraction.fields.strength.value ?? '').toLowerCase().replace(/\s/g, '') ===
      previousProduct.strength.toLowerCase().replace(/\s/g, '');
  if (
    exactReviewedPayload &&
    (!result.predictedProductId || result.predictedProductId === previousProduct.id)
  ) {
    result.predictedProductId = previousProduct.id;
    result.candidates = [
      {
        key: `product:${previousProduct.id}`,
        productId: previousProduct.id,
        name: previousProduct.name,
        strength: previousProduct.strength || null,
        dosageForm: previousProduct.dosage_form || null,
        score: 1,
        reason: 'Previously reviewed exact payload',
      },
      ...result.candidates.filter((c) => c.productId !== previousProduct.id),
    ];
    result.fields = { ...result.fields, ...catalogFields(previousProduct) };
    for (const key of fieldKeys) {
      const field = previous.extraction.fields[key];
      const isPackage = packageKeys.includes(key);
      const literalEvidence =
        field.originalValue &&
        raw.includes(field.originalValue) &&
        JSON.stringify(tokenValue(key, field.originalValue)) === JSON.stringify(field.value);
      if (
        field.value !== null &&
        field.verification === 'user_confirmed' &&
        result.fields[key].value === null &&
        (!isPackage || literalEvidence)
      )
        assign(result, key, {
          ...field,
          method: 'history',
          origin: 'history',
          verification: isPackage ? 'unverified' : 'user_confirmed',
          source: 'Previously user-confirmed scan on this device',
        });
    }
  }
  if (!result.fields.productName.value && names.length > 1)
    for (const token of names.slice(0, 4))
      result.candidates.push({
        key: `text:${token.locator}`,
        productId: null,
        name: nameOf(token.raw)!,
        strength: strengthOf(token.raw),
        dosageForm: formOf(token.raw),
        score: 0.4,
        reason: 'Unlabelled text suggestion',
      });
  const chronology = chronologyError(
    result.fields.manufacturingDate.value,
    result.fields.expiryDate.value,
  );
  if (chronology) result.issues.push(chronology);
  result.additionalInformation = result.tokens
    .filter(
      (t) =>
        !handled.has(t.locator) && !fieldKeys.some((k) => result.fields[k].locator === t.locator),
    )
    .map((t) => ({ label: t.label, value: t.raw }));
  result.issues = [...new Set(result.issues)];
  return result;
}
