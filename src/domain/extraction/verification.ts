import type { Product } from '../types';
import { validGTIN } from '../identifiers';
import { catalogFields, assign, tokenValue } from './engine';
import { chronologyError, readDate } from './dates';
import { normalizeName, normalizeForm } from './text';
import {
  emptyFields,
  evidence,
  fieldKeys,
  missing,
  packageKeys,
  productKeys,
  type Extraction,
  type FieldKey,
  type Identity,
  type Token,
} from './types';

export function copyExtraction(result: Extraction): Extraction {
  return JSON.parse(JSON.stringify(result)) as Extraction;
}
export function confirmIdentity(
  original: Extraction,
  identity: Identity,
  product: Product | null,
  identityChanged: boolean,
): Extraction {
  const reviewed = copyExtraction(original);
  if (identityChanged) {
    for (const key of productKeys) assign(reviewed, key, missing());
    // Previously stored product details belong to the rejected identity.
    for (const key of packageKeys)
      if (reviewed.fields[key].origin === 'catalog') assign(reviewed, key, missing());
  }
  if (product) reviewed.fields = { ...reviewed.fields, ...catalogFields(product) };
  reviewed.predictedProductId = product?.id ?? null;
  for (const [key, value] of [
    ['productName', identity.name],
    ['strength', identity.strength],
    ['dosageForm', identity.dosageForm],
  ] as const) {
    if (value) {
      const old = reviewed.fields[key];
      reviewed.fields[key] = {
        ...old,
        value,
        verification: 'user_confirmed',
        method: old.value === value ? old.method : 'user',
        origin: old.value === value ? old.origin : 'manual',
        source: old.value === value ? old.source : 'User-confirmed medicine identity',
      };
    } else reviewed.fields[key] = emptyFields()[key];
  }
  if (identityChanged)
    reviewed.issues = [
      ...new Set([
        ...reviewed.issues,
        'The previous medicine prediction was rejected. Product-specific information was cleared and the selected identity was looked up again.',
      ]),
    ];
  return reviewed;
}
export function editField(
  result: Extraction,
  key: FieldKey,
  text: string,
  token?: Token,
): Extraction {
  const copy = copyExtraction(result);
  const value = text.trim() ? tokenValue(key, text) : null;
  if (text.trim() && value === null)
    throw new Error(
      key === 'expiryDate' || key === 'manufacturingDate'
        ? (readDate(text).issue ?? 'Enter a valid date.')
        : 'This value could not be validated.',
    );
  if (value === null) assign(copy, key, missing());
  else
    assign(copy, key, {
      ...evidence(
        value,
        token?.raw ?? result.fields[key].originalValue,
        'user',
        token?.locator ?? result.fields[key].locator,
        'high',
      ),
      verification: 'user_confirmed',
    });
  return copy;
}
export function verifyField(result: Extraction, key: FieldKey): Extraction {
  const copy = copyExtraction(result);
  const field = copy.fields[key];
  if (field.value !== null) assign(copy, key, { ...field, verification: 'user_confirmed' });
  return copy;
}
export function validateReview(
  result: Extraction,
  identity: Identity,
  packageChecked: boolean,
  conflictChecked: boolean,
): string[] {
  const errors: string[] = [];
  if (!identity.name.trim() || identity.name.length > 160)
    errors.push('Confirm a valid medicine name.');
  if (
    result.fields.productName.value !== identity.name ||
    result.fields.strength.value !== identity.strength ||
    result.fields.dosageForm.value !== identity.dosageForm
  )
    errors.push('Medicine identity changed. Confirm the name, strength and form again.');
  if (!packageChecked)
    errors.push('Check the package details against the physical packaging before saving.');
  if ((result.identityConflict || identity.override) && !conflictChecked)
    errors.push('Acknowledge the identity conflict before saving this record.');
  for (const key of ['manufacturingDate', 'expiryDate'] as const) {
    const value = result.fields[key].value;
    if (value) {
      const parsed = readDate(value);
      if (parsed.value !== value) errors.push(`Use an unambiguous ISO date for ${key}.`);
    }
  }
  const chronology = chronologyError(
    result.fields.manufacturingDate.value,
    result.fields.expiryDate.value,
  );
  if (chronology) errors.push(chronology);
  const gtin = result.fields.gtin.value;
  if (gtin && /^\d+$/.test(gtin) && !validGTIN(gtin))
    errors.push('The numeric barcode has an invalid length or check digit.');
  for (const key of fieldKeys) {
    const value = result.fields[key].value;
    if (typeof value === 'string' && value.length > 512)
      errors.push(`The ${key} value is too long.`);
  }
  return errors;
}
export function matchesIdentity(product: Product, identity: Identity): boolean {
  return (
    normalizeName(product.name) === normalizeName(identity.name) &&
    product.strength.toLowerCase().replace(/\s/g, '') ===
      (identity.strength ?? '').toLowerCase().replace(/\s/g, '') &&
    (!identity.dosageForm ||
      normalizeForm(product.dosage_form) === normalizeForm(identity.dosageForm))
  );
}
