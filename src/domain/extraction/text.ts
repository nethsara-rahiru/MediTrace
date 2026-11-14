import type { FieldKey } from './types';
import type { Ingredient } from '../types';
export function normalizeName(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
export function strengthOf(value: string): string | null {
  return (
    value
      .match(
        /\b\d+(?:\.\d+)?\s*(?:mcg|μg|ug|mg|kg|g|ml|iu|units?|%)(?:\s*\/\s*(?:\d+(?:\.\d+)?\s*)?(?:ml|g|tablet|capsule))?(?![a-z])/i,
      )?.[0]
      .trim() ?? null
  );
}
export function formOf(value: string): string | null {
  return (
    value.match(
      /\b(?:tablets?|capsules?|oral solution|oral suspension|syrup|suspension|solution|cream|ointment|injection|eye drops|ear drops|drops|gel|powder|inhaler)\b/i,
    )?.[0] ?? null
  );
}
export function nameOf(value: string): string | null {
  const strength = strengthOf(value),
    form = formOf(value);
  let text = value.trim();
  if (strength) text = text.replace(strength, '');
  if (form) text = text.replace(new RegExp(`\\b${form}\\b`, 'i'), '');
  text = text.replace(/[\s,;|:-]+$/, '').trim();
  return /\p{L}/u.test(text) && text.length <= 160 ? text : null;
}
export function ingredientsOf(raw: string): Ingredient[] | null {
  let values: unknown = raw;
  try {
    if (raw.startsWith('[')) values = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof values === 'string')
    values = values
      .split(/[+;,\n]+/)
      .map((name) => name.trim())
      .filter(Boolean);
  if (!Array.isArray(values) || values.length > 30) return null;
  const result: Ingredient[] = [];
  for (const item of values) {
    if (typeof item === 'string') {
      const name = nameOf(item);
      if (!name) return null;
      result.push({ name, strength: strengthOf(item) ?? '' });
    } else if (item && typeof item === 'object' && !Array.isArray(item)) {
      const row = item as Record<string, unknown>;
      if (
        typeof row.name !== 'string' ||
        row.name.length > 160 ||
        (row.strength !== undefined && typeof row.strength !== 'string')
      )
        return null;
      result.push({
        name: row.name.trim(),
        strength: typeof row.strength === 'string' ? row.strength.trim() : '',
      });
    } else return null;
  }
  return result.length && result.every((i) => i.name) ? result : null;
}
const aliases: Record<FieldKey, string[]> = {
  productName: [
    'product',
    'productname',
    'medicine',
    'medicinename',
    'drug',
    'drugname',
    'brand',
    'brandname',
    'tradename',
    'name',
  ],
  activeIngredients: [
    'ingredients',
    'ingredient',
    'activeingredients',
    'activeingredient',
    'generic',
    'genericname',
    'composition',
  ],
  strength: ['strength', 'potency', 'concentration'],
  dosageForm: ['form', 'dosageform', 'pharmaceuticalform'],
  batchNumber: ['batch', 'batchno', 'batchnumber', 'lot', 'lotno', 'lotnumber'],
  manufacturingDate: [
    'mfg',
    'mfgdate',
    'manufacturingdate',
    'manufacturedate',
    'manufactureddate',
    'productiondate',
    'dateofmanufacture',
  ],
  expiryDate: [
    'exp',
    'expdate',
    'expiry',
    'expirydate',
    'expiration',
    'expirationdate',
    'useby',
    'bestbefore',
  ],
  manufacturer: ['manufacturer', 'manufacturedby', 'mfr', 'mfrname', 'company', 'manufacturername'],
  manufacturerAddress: ['address', 'manufactureraddress', 'manufacturingaddress', 'companyaddress'],
  gtin: ['gtin', 'gtin14', 'barcode', 'barcodenumber', 'productidentifier', 'ean', 'upc'],
  serialNumber: ['serial', 'serialno', 'serialnumber', 'sn'],
};
export function labelField(label: string): FieldKey | null {
  const parts = label.split('.'),
    full = label.toLowerCase().replace(/[^a-z0-9]/g, ''),
    last = parts
      .at(-1)!
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  if (/manufacturer|company/i.test(parts.slice(0, -1).join('.')) && last === 'name')
    return 'manufacturer';
  for (const [field, names] of Object.entries(aliases))
    if (names.includes(full) || names.includes(last)) return field as FieldKey;
  return null;
}
export function tokenKind(raw: string): string {
  if (/^\d{4}-\d{2}(?:-\d{2})?$|^\d{1,2}[/-]\d{4}$|^\d{1,2}[/.]\d{1,2}[/.]\d{4}$/.test(raw))
    return 'date';
  if (/^\d{8,14}$/.test(raw)) return 'digits';
  if (/\b(?:pharma(?:ceuticals)?|laborator(?:y|ies)|ltd|limited|pvt|plc|inc)\b/i.test(raw))
    return 'company';
  if (/\b(?:sri lanka|colombo|road|street|avenue|industrial estate|postal)\b/i.test(raw))
    return 'address';
  if (strengthOf(raw)) return 'strength_text';
  if (/^(?=.*[a-z])(?=.*\d)[a-z0-9._/-]{3,40}$/i.test(raw)) return 'code';
  return 'text';
}
export function nameSimilarity(a: string, b: string): number {
  a = normalizeName(a).slice(0, 128);
  b = normalizeName(b).slice(0, 128);
  if (!a || !b) return 0;
  if (a === b) return 1;
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return 1 - row[b.length] / Math.max(a.length, b.length);
}
