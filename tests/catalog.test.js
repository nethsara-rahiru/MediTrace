import { test } from 'node:test';
import assert from 'node:assert/strict';
import { database } from './helpers/database.js';
import { fetchCatalog, parseCatalogRecord } from '../src/cloud/catalog.js';
import { downloadCatalog } from '../src/data/catalog.js';
import { findProduct, getProduct, listProducts, saveProduct } from '../src/data/products.js';
const config = { url: 'https://example.supabase.co', key: 'sb_publishable_test' };
const id = '11111111-1111-4111-8111-111111111111';
const fixture = () => ({
  name: 'Synthetic catalog product',
  generic_name: 'Example ingredient',
  strength: '1 test unit',
  dosage_form: 'Test form',
  manufacturer: 'Synthetic manufacturer',
  manufacturer_address: '',
  country: '',
  category: 'Test',
  pack_size: '',
  storage: '',
  warnings: '',
  indications: '',
  prescription: '',
  source: 'Synthetic test source, not medicine information',
  verified_at: '2026-11-15',
  verification: 'source_checked',
  ingredients: [{ name: 'Example ingredient', strength: '1 test unit' }],
  barcodes: ['TEST-CLOUD-A'],
});
const row = () => ({
  id,
  product: fixture(),
  status: 'approved',
  updated_at: '2026-11-15T00:00:00Z',
});
const response =
  (rows, status = 200) =>
  async () =>
    new Response(JSON.stringify(rows), { status });
test('catalog downloads are idempotent and available to offline SQL lookup', async () => {
  const { db, native } = await database();
  try {
    assert.equal((await downloadCatalog(db, config, response([row()]))).added, 1);
    await downloadCatalog(db, config, response([row()]));
    assert.equal((await listProducts(db)).length, 1);
    const local = await findProduct(db, 'TEST-CLOUD-A');
    assert.equal(local.verification, 'source_checked');
    assert.equal(local.ingredients[0].name, 'example ingredient');
    const updated = row();
    updated.product.storage = 'Synthetic updated storage';
    await downloadCatalog(db, config, response([updated]));
    assert.equal((await getProduct(db, local.id)).storage, updated.product.storage);
  } finally {
    native.close();
  }
});
test('locally edited products and barcode collisions are never overwritten', async () => {
  const { db, native } = await database();
  try {
    const localId = await saveProduct(db, { ...fixture(), name: 'Local product' });
    assert.equal((await downloadCatalog(db, config, response([row()]))).conflicts, 1);
    assert.equal((await getProduct(db, localId)).name, 'Local product');
    const incoming = row();
    incoming.product.barcodes = ['TEST-CLOUD-B'];
    await downloadCatalog(db, config, response([incoming]));
    const imported = await findProduct(db, 'TEST-CLOUD-B');
    await saveProduct(db, { ...imported, name: 'Locally corrected name' }, imported.id);
    assert.equal((await downloadCatalog(db, config, response([incoming]))).conflicts, 1);
    assert.equal((await getProduct(db, imported.id)).name, 'Locally corrected name');
  } finally {
    native.close();
  }
});
test('withdrawals remove barcode matching and source-checked status without removing inventory references', async () => {
  const { db, native } = await database();
  try {
    await downloadCatalog(db, config, response([row()]));
    const local = await findProduct(db, 'TEST-CLOUD-A');
    await db.runAsync('INSERT INTO user_medicines(product_id,quantity) VALUES (?,?)', local.id, 1);
    const withdrawn = { ...row(), status: 'withdrawn', product: null };
    await downloadCatalog(db, config, response([withdrawn]));
    const once = await getProduct(db, local.id);
    await downloadCatalog(db, config, response([withdrawn]));
    assert.equal(await findProduct(db, 'TEST-CLOUD-A'), null);
    assert.equal(once.verification, 'user_entered');
    assert.match(once.source, /Withdrawn/);
    assert.equal((await getProduct(db, local.id)).source, once.source);
    assert.equal((await db.getFirstAsync('SELECT count(*) n FROM user_medicines')).n, 1);
  } finally {
    native.close();
  }
});
test('malformed data anywhere in the response prevents partial local imports', async () => {
  const { db, native } = await database();
  try {
    await assert.rejects(
      downloadCatalog(db, config, response([row(), { ...row(), id: 'bad' }])),
      /Invalid/,
    );
    assert.equal((await listProducts(db)).length, 0);
    assert.equal(await db.getFirstAsync('SELECT * FROM preferences'), null);
  } finally {
    native.close();
  }
});
test('a failed local write rolls back all imported products and sync metadata', async () => {
  const { db, native } = await database();
  try {
    native.exec(
      "CREATE TRIGGER fail_catalog_link BEFORE INSERT ON cloud_catalog_links BEGIN SELECT RAISE(ABORT,'synthetic write failure'); END;",
    );
    await assert.rejects(downloadCatalog(db, config, response([row()])), /synthetic write failure/);
    assert.equal((await listProducts(db)).length, 0);
    assert.equal(await db.getFirstAsync('SELECT * FROM preferences'), null);
  } finally {
    native.close();
  }
});
test('offline and missing-schema failures preserve downloaded products', async () => {
  const { db, native } = await database();
  try {
    await downloadCatalog(db, config, response([row()]));
    await assert.rejects(
      downloadCatalog(db, config, async () => {
        throw new Error('offline');
      }),
      /offline/,
    );
    await assert.rejects(downloadCatalog(db, config, response({}, 404)), /needs setup/);
    assert.equal((await listProducts(db)).length, 1);
  } finally {
    native.close();
  }
});
test('external data must contain review evidence and safe bounded fields', () => {
  for (const product of [
    { ...fixture(), verification: 'user_entered' },
    { ...fixture(), verified_at: '2026-02-30' },
    { ...fixture(), source: '' },
    { ...fixture(), barcodes: ['https://example.com'] },
    { ...fixture(), ingredients: [{ name: 'X', strength: 99 }] },
  ])
    assert.throws(() => parseCatalogRecord({ ...row(), product }));
  assert.throws(() => parseCatalogRecord({ ...row(), status: 'draft' }));
});
test('download requests contain no personal records and only use the publishable key', async () => {
  const request = async (url, options) => {
    assert.match(String(url), /\/rest\/v1\/catalog_products\?/);
    assert.equal(options?.body, undefined);
    assert.equal(options?.method, undefined);
    assert.deepEqual(options?.headers, { apikey: config.key, Accept: 'application/json' });
    assert.equal(options?.redirect, 'error');
    return new Response('[]');
  };
  assert.deepEqual(await fetchCatalog(config, request), []);
});
test('catalog pages use keyset pagination until the complete catalog is read', async () => {
  let calls = 0;
  const first = Array.from({ length: 200 }, (_, i) => ({
    ...row(),
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
  }));
  const request = async (url) => {
    calls++;
    if (calls === 1) return new Response(JSON.stringify(first));
    assert.match(String(url), /id=gt\.00000000-0000-4000-8000-000000000199/);
    return new Response('[]');
  };
  assert.equal((await fetchCatalog(config, request)).length, 200);
  assert.equal(calls, 2);
});
