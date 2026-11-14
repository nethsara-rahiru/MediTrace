import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractMedicine } from '../src/domain/extraction/engine';
import { confirmIdentity } from '../src/domain/extraction/verification';
const identity = {
  productId: null,
  name: 'Alphamed',
  strength: '500mg',
  dosageForm: null,
  override: false,
};
test('accepted first name suggests the next literal name as an uncertain ingredient', () => {
  const original = extractMedicine('Alphamed500mg\nExamplecompound250mg', 'qr', { products: [] });
  const snapshot = JSON.stringify(original);
  const reviewed = confirmIdentity(original, identity, null, true);
  assert.deepEqual(reviewed.fields.activeIngredients.value, [
    { name: 'Examplecompound', strength: '250mg' },
  ]);
  assert.equal(reviewed.fields.activeIngredients.confidence, 'low');
  assert.equal(reviewed.fields.activeIngredients.verification, 'unverified');
  assert.equal(reviewed.fields.activeIngredients.originalValue, 'Examplecompound250mg');
  assert.equal(JSON.stringify(original), snapshot);
});
test('accepting an alternative or changing strength does not reinterpret the first identity', () => {
  const original = extractMedicine('Alphamed500mg\nExamplecompound250mg', 'qr', { products: [] });
  for (const selection of [
    { ...identity, name: 'Examplecompound', strength: '250mg' },
    { ...identity, strength: '250mg' },
  ]) {
    assert.equal(
      confirmIdentity(original, selection, null, true).fields.activeIngredients.value,
      null,
    );
  }
});
test('labelled ingredients are preserved and codes and addresses are excluded', () => {
  const labelled = extractMedicine(
    'Product: Alphamed500mg\nIngredients: Examplecompound250mg',
    'qr',
    { products: [] },
  );
  assert.deepEqual(
    confirmIdentity(labelled, identity, null, false).fields.activeIngredients.value,
    labelled.fields.activeIngredients.value,
  );
  const other = extractMedicine(
    'Alphamed500mg\nAB12345678\n123 Long Road, Colombo, Sri Lanka',
    'qr',
    { products: [] },
  );
  assert.equal(confirmIdentity(other, identity, null, false).fields.activeIngredients.value, null);
});
test('catalog alternatives without literal evidence and conflicting scans are excluded', () => {
  const original = extractMedicine('Alphamed500mg', 'qr', { products: [] });
  original.candidates.push({
    key: 'product:2',
    productId: 2,
    name: 'Betamed',
    strength: '250mg',
    dosageForm: null,
    score: 0.3,
    reason: 'Similar local name',
  });
  assert.equal(
    confirmIdentity(original, identity, null, false).fields.activeIngredients.value,
    null,
  );
  const conflict = extractMedicine('Alphamed500mg\nExamplecompound250mg', 'qr', { products: [] });
  conflict.identityConflict = true;
  assert.equal(
    confirmIdentity(conflict, identity, null, true).fields.activeIngredients.value,
    null,
  );
});
