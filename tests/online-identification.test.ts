import { test } from 'node:test';
import assert from 'node:assert/strict';
import { database } from './helpers/database';
import {
  beginIdentification,
  acceptIdentity,
  getSession,
  persistReview,
  rejectIdentity,
} from '../src/data/identification';
import { saveProduct, listProducts } from '../src/data/products';
import {
  checkConfirmedMedicine,
  applyOnlineCheck,
  chooseOnlineField,
} from '../src/data/onlineIdentification';
import { editField } from '../src/domain/extraction/verification';
import { lookupConfirmedProduct } from '../src/cloud/lookup';
import type { ProductInput } from '../src/domain/types';
const config = { url: 'https://example.supabase.co', key: 'sb_publishable_test' };
const fixture = (): ProductInput => ({
  name: 'Syntheticmed',
  generic_name: '',
  strength: '500mg',
  dosage_form: 'Tablet',
  manufacturer: 'Online manufacturer',
  manufacturer_address: 'Online address',
  country: '',
  category: 'Test',
  pack_size: '',
  storage: '',
  warnings: '',
  indications: '',
  prescription: '',
  source: 'Synthetic source only',
  verification: 'user_entered',
  verified_at: null,
  ingredients: [{ name: 'Example compound', strength: '500mg' }],
  barcodes: ['TEST-ONLINE-ONLY'],
});
const record = () => ({
  id: '11111111-1111-4111-8111-111111111111',
  status: 'community',
  product: fixture(),
  updated_at: '2026-11-15T00:00:00Z',
});
const response =
  (rows: unknown): typeof fetch =>
  async () =>
    new Response(JSON.stringify(rows));
async function confirmed(
  db: Awaited<ReturnType<typeof database>>['db'],
  raw = 'Product: Syntheticmed 500mg\nForm: Tablet',
) {
  const id = await beginIdentification(db, raw, 'qr', `test-${Math.random()}`);
  return acceptIdentity(db, id, { name: 'Syntheticmed', strength: '500mg', dosageForm: 'Tablet' });
}
test('an online-only exact match fills missing fields and becomes an offline product without upload', async () => {
  const { db, native } = await database();
  try {
    const s = await confirmed(db);
    const original = JSON.stringify(s.original);
    const check = await checkConfirmedMedicine(db, s, config, undefined, response([record()]));
    assert.equal(check.status, 'matched');
    const updated = await applyOnlineCheck(db, s.id, check, config.url);
    assert.equal(updated!.reviewed!.fields.manufacturer.value, 'Online manufacturer');
    assert.equal(updated!.reviewed!.fields.manufacturer.retrieval, 'online');
    assert.equal(updated!.reviewed!.fields.manufacturer.verification, 'unverified');
    assert.equal(JSON.stringify(updated!.original), original);
    assert.ok(updated!.identity!.productId);
    assert.equal((await listProducts(db)).length, 1);
    assert.equal(
      (await db.getFirstAsync<{ n: number }>('SELECT count(*) n FROM product_publications'))!.n,
      0,
    );
    assert.equal((await getSession(db, s.id))!.onlineCheck!.status, 'matched');
  } finally {
    native.close();
  }
});
test('local data stays unchanged until the user explicitly chooses an online conflict', async () => {
  const { db, native } = await database();
  try {
    await saveProduct(db, { ...fixture(), manufacturer: 'Local manufacturer' });
    const s = await confirmed(db);
    assert.equal(s.reviewed!.fields.manufacturer.value, 'Local manufacturer');
    const check = await checkConfirmedMedicine(db, s, config, undefined, response([record()]));
    assert.equal(check.status, 'conflict');
    const updated = await applyOnlineCheck(db, s.id, check, config.url);
    assert.equal(updated!.reviewed!.fields.manufacturer.value, 'Local manufacturer');
    const chosen = await chooseOnlineField(db, s.id, 'manufacturer', config.url);
    assert.equal(chosen.reviewed!.fields.manufacturer.value, 'Online manufacturer');
    assert.equal(chosen.reviewed!.fields.manufacturer.retrieval, 'online');
    assert.equal(chosen.reviewed!.fields.manufacturer.verification, 'unverified');
    assert.equal((await listProducts(db))[0].manufacturer, 'Local manufacturer');
  } finally {
    native.close();
  }
});
test('source-checked online information keeps its independent review status', async () => {
  const { db, native } = await database();
  try {
    const s = await confirmed(db);
    const r = {
      ...record(),
      status: 'approved',
      product: { ...fixture(), verification: 'source_checked', verified_at: '2026-11-15' },
    };
    const check = await checkConfirmedMedicine(db, s, config, undefined, response([r]));
    const updated = await applyOnlineCheck(db, s.id, check, config.url);
    assert.equal(updated!.reviewed!.fields.activeIngredients.verification, 'source_checked');
  } finally {
    native.close();
  }
});
test('wrong strength, missing strength and ambiguous variants never populate medicine facts', async () => {
  const { db, native } = await database();
  try {
    const s = await confirmed(db);
    assert.equal(
      (
        await checkConfirmedMedicine(
          db,
          s,
          config,
          undefined,
          response([{ ...record(), product: { ...fixture(), strength: '250mg' } }]),
        )
      ).status,
      'identity_conflict',
    );
    assert.equal(
      (
        await checkConfirmedMedicine(
          db,
          s,
          config,
          undefined,
          response([record(), { ...record(), id: '22222222-2222-4222-8222-222222222222' }]),
        )
      ).status,
      'ambiguous',
    );
    const noStrength = { ...s, identity: { ...s.identity!, strength: null } };
    assert.equal(
      (await checkConfirmedMedicine(db, noStrength, config, undefined, response([record()])))
        .status,
      'identity_conflict',
    );
  } finally {
    native.close();
  }
});
test('online absence, errors and malformed responses preserve scan data', async () => {
  const { db, native } = await database();
  try {
    const s = await confirmed(
      db,
      'Product: Syntheticmed 500mg\nForm: Tablet\nManufacturer: Scanned company',
    );
    for (const request of [
      response([]),
      response([{ id: 'bad' }]),
      async () => {
        throw new Error('offline');
      },
    ] as (typeof fetch)[]) {
      const check = await checkConfirmedMedicine(db, s, config, undefined, request);
      assert.ok(['not_found', 'unavailable'].includes(check.status));
      const updated = await applyOnlineCheck(db, s.id, check, config.url);
      assert.equal(updated!.reviewed!.fields.manufacturer.value, 'Scanned company');
    }
  } finally {
    native.close();
  }
});
test('late results cannot attach to a rejected identity or overwrite manual edits', async () => {
  const { db, native } = await database();
  try {
    let s = await confirmed(db);
    const check = await checkConfirmedMedicine(db, s, config, undefined, response([record()]));
    await persistReview(db, s.id, editField(s.reviewed!, 'manufacturer', 'User correction'));
    s = (await applyOnlineCheck(db, s.id, check, config.url))!;
    assert.equal(s.reviewed!.fields.manufacturer.value, 'User correction');
    assert.equal(s.onlineCheck!.status, 'conflict');
    await rejectIdentity(db, s.id);
    assert.equal(await applyOnlineCheck(db, s.id, check, config.url), null);
  } finally {
    native.close();
  }
});
test('uncommitted edits protect empty fields while other missing information can load', async () => {
  const { db, native } = await database();
  try {
    const s = await confirmed(db);
    const check = await checkConfirmedMedicine(db, s, config, undefined, response([record()]));
    const updated = (await applyOnlineCheck(db, s.id, check, config.url, ['manufacturer']))!;
    assert.equal(updated.reviewed!.fields.manufacturer.value, null);
    assert.equal(updated.reviewed!.fields.manufacturerAddress.value, 'Online address');
  } finally {
    native.close();
  }
});
test('known pack mismatch and withdrawn online records require review', async () => {
  const { db, native } = await database();
  try {
    await saveProduct(db, { ...fixture(), pack_size: '10 tablets' });
    const s = await confirmed(db);
    assert.equal(
      (
        await checkConfirmedMedicine(
          db,
          s,
          config,
          undefined,
          response([{ ...record(), product: { ...fixture(), pack_size: '20 tablets' } }]),
        )
      ).status,
      'identity_conflict',
    );
    assert.equal(
      (
        await checkConfirmedMedicine(
          db,
          s,
          config,
          undefined,
          response([{ ...record(), status: 'withdrawn' }]),
        )
      ).status,
      'withdrawn',
    );
  } finally {
    native.close();
  }
});
test('lookup sends only confirmed identity or barcode and escapes wildcard names', async () => {
  const identity = {
    productId: null,
    name: 'Test%_name',
    strength: '500mg',
    dosageForm: 'Tablet',
    override: false,
  };
  let calls = 0;
  const request: typeof fetch = async (url, options) => {
    calls++;
    assert.equal(options?.body, undefined);
    const decoded = decodeURIComponent(String(url));
    assert.doesNotMatch(decoded, /batch|serial|PRIVATE/);
    if (calls === 1) assert.match(decoded, /barcodes=cs\.\["TEST-ID"\]/);
    else assert.ok(decoded.includes('name=ilike.Test\\%\\_name'));
    return new Response('[]');
  };
  await lookupConfirmedProduct(config, identity, 'TEST-ID', undefined, undefined, request);
  assert.equal(calls, 2);
});
test('online queries cannot run before identity confirmation', async () => {
  const { db, native } = await database();
  try {
    const id = await beginIdentification(db, 'Product: Syntheticmed', 'qr', 'pending');
    await assert.rejects(
      checkConfirmedMedicine(db, (await getSession(db, id))!, config, undefined, response([])),
      /Confirm/,
    );
  } finally {
    native.close();
  }
});

test('conflicting scan data is not bound to an online cache until the difference is explicitly resolved', async () => {
  const { db, native } = await database();
  try {
    const session = await confirmed(
      db,
      'Product: Syntheticmed 500mg\nForm: Tablet\nManufacturer: Scanned company',
    );
    const check = await checkConfirmedMedicine(
      db,
      session,
      config,
      undefined,
      response([record()]),
    );
    const first = await applyOnlineCheck(db, session.id, check, config.url);
    assert.equal(first!.onlineCheck!.status, 'conflict');
    assert.equal(first!.identity!.productId, null);
    assert.equal((await listProducts(db)).length, 0);
    const chosen = await chooseOnlineField(db, session.id, 'manufacturer', config.url);
    assert.equal(chosen.onlineCheck!.status, 'matched');
    assert.ok(chosen.identity!.productId);
    assert.equal((await listProducts(db)).length, 1);
  } finally {
    native.close();
  }
});
