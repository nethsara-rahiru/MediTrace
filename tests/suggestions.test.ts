import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractMedicine } from '../src/domain/extraction/engine';
import {
  bestIdentitySuggestion,
  otherIdentitySuggestions,
} from '../src/domain/extraction/suggestions';
import type { Candidate } from '../src/domain/extraction/types';
const candidate = (
  key: string,
  name: string,
  strength: string,
  score: number,
  productId: number | null = null,
): Candidate => ({
  key,
  name,
  strength,
  dosageForm: null,
  score,
  productId,
  reason: 'Synthetic test suggestion',
});
test('one ranked proposal is available even when extraction keeps identities ambiguous', () => {
  const result = extractMedicine('Alphamed500mg\nBetamed250mg', 'qr', { products: [] });
  assert.equal(result.fields.productName.value, null);
  const before = JSON.stringify(result);
  const best = bestIdentitySuggestion(result)!;
  assert.equal(best.name, 'Alphamed');
  assert.equal(best.strength, '500mg');
  assert.equal(best.productId, null);
  assert.equal(JSON.stringify(result), before);
});
test('same-name local variants propose just the best compatible candidate', () => {
  const result = extractMedicine('Product: Alphamed', 'qr', { products: [] });
  result.candidates = [
    candidate('weak', 'Alphamed', '250mg', 0.8, 2),
    candidate('best', 'Alphamed', '500mg', 1, 1),
  ];
  const best = bestIdentitySuggestion(result)!;
  assert.equal(best.key, 'best');
  assert.equal(otherIdentitySuggestions(result, [best.key])[0].key, 'weak');
  assert.equal(result.predictedProductId, null);
});
test('explicitly detected identity takes priority over incompatible or ingredient-only suggestions', () => {
  const result = extractMedicine('Product: Alphamed500mg', 'qr', { products: [] });
  result.candidates = [
    candidate('other', 'Betamed', '250mg', 0.9, 2),
    candidate('wrong-strength', 'Alphamed', '250mg', 0.9, 3),
  ];
  const best = bestIdentitySuggestion(result)!;
  assert.equal(best.name, 'Alphamed');
  assert.equal(best.strength, '500mg');
  assert.equal(best.productId, null);
});
test('rejected text identities and duplicate aliases do not appear among alternatives', () => {
  const result = extractMedicine('Alphamed500mg\nBetamed250mg', 'qr', { products: [] });
  const best = bestIdentitySuggestion(result)!;
  result.candidates.push({ ...best, key: 'duplicate' });
  const alternatives = otherIdentitySuggestions(result, [best.key]);
  assert.deepEqual(
    alternatives.map((c) => c.name),
    ['Betamed'],
  );
});
test('a sole detected name still has an identity key and no-name scans remain manual', () => {
  assert.equal(
    bestIdentitySuggestion(extractMedicine('Product: Alphamed500mg', 'qr', { products: [] }))?.name,
    'Alphamed',
  );
  assert.equal(
    bestIdentitySuggestion(extractMedicine('Batch: AB123456', 'qr', { products: [] })),
    null,
  );
});
