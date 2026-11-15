import { test } from 'node:test';
import assert from 'node:assert/strict';
import { database } from './helpers/database';
import {
  beginIdentification,
  getSession,
  rejectIdentity,
  acceptIdentity,
} from '../src/data/identification';
import {
  needsOnlineIdentity,
  findOnlineIdentity,
  storeOnlineIdentity,
  confirmOnlineIdentity,
} from '../src/data/onlineIdentity';
import { listProducts, saveProduct } from '../src/data/products';
import { identifierVariants } from '../src/cloud/lookup';
import type { ProductInput } from '../src/domain/types';
const config = { url: 'https://example.supabase.co', key: 'sb_publishable_test' };
const raw = '4006381333931',
  normalized = '04006381333931';
const product = (): ProductInput => ({
  name: 'Syntheticbarcode',
  generic_name: '',
  strength: '500mg',
  dosage_form: 'Tablet',
  manufacturer: 'Hidden until confirmed',
  manufacturer_address: '',
  country: '',
  category: 'Test',
  pack_size: '10 tablets',
  storage: '',
  warnings: '',
  indications: '',
  prescription: '',
  source: 'Synthetic test fixture only',
  verification: 'user_entered',
  verified_at: null,
  ingredients: [],
  barcodes: [raw],
});
const record = () => ({
  id: '11111111-1111-4111-8111-111111111111',
  updated_at: '2026-11-15T00:00:00Z',
  status: 'community',
  product: product(),
});
const response =
  (rows: unknown): typeof fetch =>
  async () =>
    new Response(JSON.stringify(rows));
async function pending(db: Awaited<ReturnType<typeof database>>['db']) {
  const id = await beginIdentification(db, raw, 'ean13', 'barcode-identity');
  return (await getSession(db, id))!;
}
test('unknown numeric barcode resolves online before confirmation without revealing or importing details', async () => {
  const { db, native } = await database();
  try {
    const session = await pending(db);
    assert.equal(needsOnlineIdentity(session), true);
    assert.equal(session.original.fields.productName.value, null);
    const original = JSON.stringify(session.original);
    const result = await findOnlineIdentity(session, config, undefined, response([record()]));
    assert.equal(result.status, 'matched');
    assert.equal(result.record!.product!.name, 'Syntheticbarcode');
    const stored = (await storeOnlineIdentity(db, session.id, result))!;
    assert.equal(stored.state, 'pending');
    assert.equal(stored.identity, null);
    assert.equal(stored.reviewed, null);
    assert.equal((await listProducts(db)).length, 0);
    assert.equal(JSON.stringify(stored.original), original);
    const confirmed = await confirmOnlineIdentity(db, session.id, result.record!.id, config.url);
    assert.equal(confirmed.state, 'identity_confirmed');
    assert.equal(confirmed.identity!.name, 'Syntheticbarcode');
    assert.equal(confirmed.reviewed!.fields.manufacturer.value, 'Hidden until confirmed');
    assert.equal(confirmed.reviewed!.fields.manufacturer.retrieval, 'online');
    assert.equal(confirmed.reviewed!.fields.manufacturer.verification, 'unverified');
    assert.equal(confirmed.original.raw, raw);
    assert.equal((await listProducts(db)).length, 1);
    assert.equal(
      (await db.getFirstAsync<{ n: number }>('SELECT count(*) n FROM product_publications'))!.n,
      0,
    );
  } finally {
    native.close();
  }
});
test('local matches and QR names retain the immediate confirmation workflow', async () => {
  const { db, native } = await database();
  try {
    await saveProduct(db, product());
    assert.equal(needsOnlineIdentity(await pending(db)), false);
    const id = await beginIdentification(
      db,
      'Product: Syntheticbarcode 500mg',
      'qr',
      'labelled-name',
    );
    assert.equal(needsOnlineIdentity((await getSession(db, id))!), false);
  } finally {
    native.close();
  }
});
test('absent, ambiguous, malformed and offline lookups preserve manual identification', async () => {
  const { db, native } = await database();
  try {
    const session = await pending(db);
    for (const [request, status] of [
      [response([]), 'not_found'],
      [
        response([record(), { ...record(), id: '22222222-2222-4222-8222-222222222222' }]),
        'ambiguous',
      ],
      [response([{ id: 'bad' }]), 'unavailable'],
      [
        async () => {
          throw new Error('offline');
        },
        'unavailable',
      ],
    ] as [typeof fetch, string][]) {
      const result = await findOnlineIdentity(session, config, undefined, request);
      assert.equal(result.status, status);
      assert.equal((await storeOnlineIdentity(db, session.id, result))!.reviewed, null);
    }
    const manual = await acceptIdentity(db, session.id, { name: 'Manually entered medicine' });
    assert.equal(manual.identity!.name, 'Manually entered medicine');
  } finally {
    native.close();
  }
});
test('rejection and a late lookup cannot import a rejected medicine', async () => {
  const { db, native } = await database();
  try {
    const session = await pending(db);
    const result = await findOnlineIdentity(session, config, undefined, response([record()]));
    await storeOnlineIdentity(db, session.id, result);
    await rejectIdentity(db, session.id);
    assert.equal(await storeOnlineIdentity(db, session.id, result), null);
    await assert.rejects(
      confirmOnlineIdentity(db, session.id, result.record!.id, config.url),
      /no longer/,
    );
    assert.equal((await listProducts(db)).length, 0);
  } finally {
    native.close();
  }
});
test('returned unrelated barcodes cannot become identity suggestions', async () => {
  const { db, native } = await database();
  try {
    const session = await pending(db);
    const result = await findOnlineIdentity(
      session,
      config,
      undefined,
      response([{ ...record(), product: { ...product(), barcodes: ['OTHER-CODE'] } }]),
    );
    assert.equal(result.status, 'not_found');
    assert.equal(result.record, undefined);
  } finally {
    native.close();
  }
});
test('identifier lookup uses only the code and equivalent GTIN forms, never a guessed name', async () => {
  const { db, native } = await database();
  try {
    let calls = 0;
    const result = await findOnlineIdentity(
      await pending(db),
      config,
      undefined,
      async (url, options) => {
        calls++;
        const decoded = decodeURIComponent(String(url));
        assert.ok(decoded.includes(normalized));
        assert.ok(decoded.includes(raw));
        assert.doesNotMatch(decoded, /name=|PRIVATE|batch|serial/);
        assert.equal(options?.body, undefined);
        return new Response('[]');
      },
    );
    assert.equal(result.status, 'not_found');
    assert.equal(calls, 1);
    assert.ok(identifierVariants(normalized).includes(raw));
    assert.deepEqual(identifierVariants('CUSTOM-CODE'), ['CUSTOM-CODE']);
  } finally {
    native.close();
  }
});
