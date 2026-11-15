import type { CatalogRecord } from '../cloud/catalog';
import type { FieldKey, Identity, Extraction } from './extraction/types';
import { normalizeName, normalizeForm } from './extraction/text';
export type OnlineCheck = {
  identityKey: string;
  status:
    | 'matched'
    | 'conflict'
    | 'identity_conflict'
    | 'ambiguous'
    | 'not_found'
    | 'unavailable'
    | 'withdrawn';
  checkedAt: string;
  message: string;
  record?: CatalogRecord;
  conflicts: FieldKey[];
};
export const enrichmentKeys = ['activeIngredients', 'manufacturer', 'manufacturerAddress'] as const;
export function identityKey(identity: Identity) {
  return JSON.stringify([
    identity.productId,
    normalizeName(identity.name),
    (identity.strength ?? '').toLowerCase().replace(/\s/g, ''),
    normalizeForm(identity.dosageForm ?? ''),
    identity.override,
  ]);
}
export function compatibleIdentity(identity: Identity, record: CatalogRecord) {
  const product = record.product;
  return Boolean(
    product &&
    normalizeName(product.name) === normalizeName(identity.name) &&
    product.strength.toLowerCase().replace(/\s/g, '') ===
      (identity.strength ?? '').toLowerCase().replace(/\s/g, '') &&
    (!identity.dosageForm ||
      normalizeForm(product.dosage_form) === normalizeForm(identity.dosageForm)),
  );
}
export function equalField(a: unknown, b: unknown) {
  const normalize = (v: unknown): unknown =>
    Array.isArray(v)
      ? v
          .map((i) => ({
            name: normalizeName(i.name),
            strength: String(i.strength ?? '')
              .toLowerCase()
              .replace(/\s/g, ''),
          }))
          .sort((x, y) => x.name.localeCompare(y.name))
      : typeof v === 'string'
        ? normalizeName(v)
        : v;
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}
export function onlineConflicts(extraction: Extraction, values: Partial<Extraction['fields']>) {
  return enrichmentKeys.filter(
    (key) =>
      extraction.fields[key].value !== null &&
      values[key]?.value != null &&
      !equalField(extraction.fields[key].value, values[key]!.value),
  );
}
