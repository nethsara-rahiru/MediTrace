import { normalizeName, normalizeForm } from './extraction/text.js';
export const enrichmentKeys = ['activeIngredients', 'manufacturer', 'manufacturerAddress'];
export function identityKey(identity) {
  return JSON.stringify([
    identity.productId,
    normalizeName(identity.name),
    (identity.strength ?? '').toLowerCase().replace(/\s/g, ''),
    normalizeForm(identity.dosageForm ?? ''),
    identity.override,
  ]);
}
export function compatibleIdentity(identity, record) {
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
export function equalField(a, b) {
  const normalize = (v) =>
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
export function onlineConflicts(extraction, values) {
  return enrichmentKeys.filter(
    (key) =>
      extraction.fields[key].value !== null &&
      values[key]?.value != null &&
      !equalField(extraction.fields[key].value, values[key].value),
  );
}
