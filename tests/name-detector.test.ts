import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameClues, nameOf, strengthOf, tokenKind } from '../src/domain/extraction/text';
import { extractMedicine } from '../src/domain/extraction/engine';
import type { Product } from '../src/domain/types';
// Synthetic names only; no records are seeded into the application.
const known = (name: string): Product => ({
  id: 1,
  name,
  strength: '',
  dosage_form: '',
  generic_name: '',
  manufacturer: '',
  manufacturer_address: '',
  country: '',
  category: 'Test',
  pack_size: '',
  storage: '',
  warnings: '',
  indications: '',
  prescription: '',
  source: 'Synthetic test fixture',
  verified_at: null,
  verification: 'user_entered',
  created_at: '',
  ingredients: [],
  barcodes: ['04006381333931'],
});

test('recognised g, mg and ml amounts are separated from names, including attached strengths', () => {
  for (const [raw, name, amount] of [
    ['Examplemed500mg', 'Examplemed', '500mg'],
    ['Examplemed 2 g', 'Examplemed', '2 g'],
    ['Examplemed10ml', 'Examplemed', '10ml'],
    ['Examplemed 500mg + 65mg', 'Examplemed', '500mg + 65mg'],
  ]) {
    assert.equal(nameOf(raw), name);
    assert.equal(strengthOf(raw), amount);
    assert.equal(nameClues(raw).kind, 'name');
    const r = extractMedicine(raw + '\nBatch: AB12345', 'qr', { products: [] });
    assert.equal(r.fields.productName.value, name);
    assert.equal(r.fields.strength.value, amount);
  }
});
test('long comma-separated address text is retained as an uncertain address rather than a name', () => {
  const address = 'No. 22, Eastern Gardens, Central District, 20400';
  assert.equal(tokenKind(address), 'address');
  assert.equal(
    tokenKind('Example Pharma Ltd, No. 22, Eastern Gardens, Central District'),
    'address',
  );
  for (const lines of [
    [address, 'Examplemed 500mg'],
    ['Examplemed 500mg', address],
  ]) {
    const r = extractMedicine(lines.join('\n'), 'qr', { products: [] });
    assert.equal(r.fields.productName.value, 'Examplemed');
    assert.equal(r.fields.manufacturerAddress.value, address);
    assert.equal(r.fields.manufacturerAddress.verification, 'unverified');
  }
  const alone = extractMedicine(address, 'qr', { products: [] });
  assert.equal(alone.fields.productName.value, null);
  assert.equal(alone.fields.gtin.value, null);
});
test('dense digit runs, separated numeric groups and mixed codes never become unlabelled medicine names', () => {
  for (const raw of [
    'AB987654321',
    'AB12 CD34 EF56',
    'R7T2Y8U9',
    '999 888 777 666',
    'AB7654mg 98 76 54',
  ]) {
    assert.equal(nameClues(raw).kind, 'code');
    const r = extractMedicine(raw + '\nEXP: 2028-01', 'qr', { products: [] });
    assert.equal(r.fields.productName.value, null);
    assert.ok(r.candidates.every((c) => c.productId !== null));
  }
});
test('strength alone and long prose cannot identify a medicine or become its barcode', () => {
  for (const text of [
    '500mg',
    '10 ml',
    'This is a long explanation about how this packaging was printed and where to find the manufacturing details',
  ]) {
    const r = extractMedicine(text, 'qr', { products: [] });
    assert.equal(r.fields.productName.value, null);
    assert.equal(r.fields.gtin.value, null);
  }
  const r = extractMedicine('Examplemed\n500mg\nBatch: AB123456', 'qr', { products: [] });
  assert.equal(r.fields.productName.value, 'Examplemed');
  assert.equal(r.fields.strength.value, '500mg');
  assert.equal(r.fields.strength.verification, 'unverified');
});
test('numeric brand names survive explicit labels and exact local matches without fuzzy number swaps', () => {
  assert.equal(
    extractMedicine('Product: Formula2', 'qr', { products: [] }).fields.productName.value,
    'Formula2',
  );
  const direct = extractMedicine('Formula2', 'qr', { products: [known('Formula2')] });
  assert.equal(direct.predictedProductId, 1);
  assert.equal(direct.fields.productName.value, 'Formula2');
  const contextual = extractMedicine('Formula2\nOtherword 10ml', 'qr', {
    products: [known('Formula2')],
  });
  assert.equal(contextual.predictedProductId, 1);
  assert.equal(contextual.fields.productName.value, 'Formula2');
  assert.equal(contextual.fields.strength.value, null);
  const different = extractMedicine('Product: Formula3', 'qr', { products: [known('Formula2')] });
  assert.equal(different.predictedProductId, null);
  assert.equal(different.fields.productName.value, 'Formula3');
  const conflict = extractMedicine(
    JSON.stringify({ product: 'Formula3', gtin: '04006381333931' }),
    'qr',
    { products: [known('Formula2')] },
  );
  assert.equal(conflict.identityConflict, true);
});
test('address and code text cannot drive a fuzzy catalogue match', () => {
  assert.equal(
    extractMedicine('Alphamed Road\nEXP: 2028-01', 'qr', { products: [known('Alphamed')] })
      .predictedProductId,
    null,
  );
  assert.equal(
    extractMedicine('AB1234567\nEXP: 2028-01', 'qr', { products: [known('AB123456')] })
      .predictedProductId,
    null,
  );
});
test('ranking prefers a clean name with strength while preserving close alternatives', () => {
  const r = extractMedicine('Otherword\nExamplemed500mg\nAB12 CD34 EF56', 'qr', { products: [] });
  assert.equal(r.fields.productName.value, 'Examplemed');
  assert.ok(r.candidates.some((c) => c.name === 'Otherword'));
  assert.equal(r.fields.productName.verification, 'unverified');
  const numeric = extractMedicine('Formula2\nBatch: AB123456', 'qr', { products: [] });
  assert.equal(numeric.fields.productName.value, null);
  assert.ok(numeric.candidates.some((c) => c.name === 'Formula2'));
  const tied = extractMedicine('Examplemed500mg\nOthermed250mg', 'qr', { products: [] });
  assert.equal(tied.fields.productName.value, null);
  assert.equal(tied.candidates.length, 2);
});
test('short comma-separated names and numbered ingredient names are not globally rejected', () => {
  assert.notEqual(nameClues('Examplemed, Plus').kind, 'address');
  const r = extractMedicine(
    'Product: Examplemed, Plus\nIngredients: 5-Example compound 50mg',
    'qr',
    { products: [] },
  );
  assert.equal(r.fields.productName.value, 'Examplemed, Plus');
  assert.equal(r.fields.activeIngredients.value?.[0].name, '5-Example compound');
});
