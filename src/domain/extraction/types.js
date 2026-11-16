export const scalarKeys = [
  'productName',
  'strength',
  'dosageForm',
  'batchNumber',
  'manufacturingDate',
  'expiryDate',
  'manufacturer',
  'manufacturerAddress',
  'gtin',
  'serialNumber',
];
export const fieldKeys = [...scalarKeys, 'activeIngredients'];
export const productKeys = [
  'productName',
  'strength',
  'dosageForm',
  'activeIngredients',
  'manufacturer',
  'manufacturerAddress',
];
export const packageKeys = [
  'batchNumber',
  'manufacturingDate',
  'expiryDate',
  'gtin',
  'serialNumber',
];
export function missing() {
  return {
    value: null,
    originalValue: null,
    method: 'none',
    confidence: 'none',
    verification: 'missing',
    source: null,
    origin: 'payload',
    locator: null,
  };
}
export function emptyFields() {
  return Object.fromEntries(fieldKeys.map((k) => [k, missing()]));
}
export function evidence(value, raw, method, locator = null, confidence = 'medium') {
  return {
    value,
    originalValue: raw,
    method,
    confidence,
    verification: 'unverified',
    source: method === 'user' ? 'User correction' : 'Scanned packaging content',
    origin: method === 'user' ? 'manual' : 'payload',
    locator,
  };
}
