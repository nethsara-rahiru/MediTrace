import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractMedicine } from '../src/domain/extraction/engine';
import { optionalAIFallback, validateAIResponse } from '../src/domain/extraction/optional-ai';
test('optional AI is opt-in, schema checked and bounded on failures', async () => {
  const base = extractMedicine('TradeLabel: Alphamed 500mg', 'qr', { products: [] });
  let called = false;
  assert.equal(
    await optionalAIFallback(base, {
      adapter: async () => {
        called = true;
        throw new Error();
      },
    }),
    base,
  );
  assert.equal(called, false);
  const failed = await optionalAIFallback(base, {
    consent: true,
    adapter: async () => {
      throw new Error('offline');
    },
  });
  assert.equal(failed.fields.productName.value, null);
  assert.ok(failed.issues.some((x) => x.includes('unavailable')));
  const invalid = await optionalAIFallback(base, {
    consent: true,
    adapter: async () => ({ productName: { value: 'Invented', originalValue: 'Not in scan' } }),
  });
  assert.equal(invalid.fields.productName.value, null);
  const timeout = await optionalAIFallback(base, {
    consent: true,
    timeoutMs: 1,
    adapter: () => new Promise(() => {}),
  });
  assert.ok(timeout.issues.some((x) => x.includes('unavailable')));
  const valid = await optionalAIFallback(base, {
    consent: true,
    adapter: async () => ({ productName: { value: 'Alphamed', originalValue: 'Alphamed 500mg' } }),
  });
  assert.equal(valid.fields.productName.method, 'ai');
  assert.equal(valid.fields.productName.verification, 'unverified');
  assert.throws(() =>
    validateAIResponse(base.raw, {
      productName: {
        value: 'Alphamed',
        originalValue: 'Alphamed 500mg',
        verification: 'source_checked',
      },
    }),
  );
});

test('unsafe and oversized payloads never reach an optional AI adapter', async () => {
  let calls = 0;
  const adapter = async () => {
    calls++;
    return {};
  };
  for (const text of ['{"__proto__":{"name":"Bad"}}', 'x'.repeat(4097)]) {
    const result = extractMedicine(text, 'qr', { products: [] });
    assert.equal(await optionalAIFallback(result, { adapter, consent: true }), result);
  }
  assert.equal(calls, 0);
});
test('AI timeout aborts its request and never upgrades evidence to trusted status', async () => {
  const base = extractMedicine('TradeLabel: Alphamed 500mg', 'qr', { products: [] });
  let aborted = false;
  const result = await optionalAIFallback(base, {
    consent: true,
    timeoutMs: 2,
    adapter: ({ signal }) =>
      new Promise(() => {
        signal.addEventListener('abort', () => {
          aborted = true;
        });
      }),
  });
  assert.equal(aborted, true);
  assert.equal(result.fields.productName.value, null);
  const valid = await optionalAIFallback(base, {
    consent: true,
    adapter: async () => ({ productName: { value: 'Alphamed', originalValue: 'Alphamed 500mg' } }),
  });
  assert.equal(valid.fields.productName.confidence, 'low');
  assert.equal(valid.fields.productName.verification, 'unverified');
  assert.equal(base.fields.productName.value, null);
});
