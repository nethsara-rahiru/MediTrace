import { test } from 'node:test';
import assert from 'node:assert/strict';
import { database } from './helpers/database.js';
import { saveProduct, getProduct, listProducts } from '../src/data/products.js';
import {
  publicProduct,
  flushPublications,
  listPublicationStates,
} from '../src/data/publications.js';
import { downloadCatalog } from '../src/data/catalog.js';
import {
  beginIdentification,
  acceptIdentity,
  saveIdentification,
} from '../src/data/identification.js';
const config = { url: 'https://example.supabase.co', key: 'sb_publishable_test' };
const fixture = () => ({
  name: 'Synthetic community product',
  generic_name: '',
  strength: '1 test unit',
  dosage_form: '',
  manufacturer: '',
  manufacturer_address: '',
  country: '',
  category: 'Test',
  pack_size: '',
  storage: '',
  warnings: '',
  indications: '',
  prescription: '',
  source: 'Synthetic test fixture only',
  verified_at: null,
  verification: 'user_entered',
  ingredients: [],
  barcodes: ['TEST-SHARED-ONLY'],
});
const ack = async (_url, options) =>
  new Response(JSON.stringify(JSON.parse(String(options?.body)).p_id));
test('a product save atomically queues public reference data and upload marks it shared', async () => {
  const { db, native } = await database();
  try {
    const id = await saveProduct(db, fixture(), undefined, 'own', config.url);
    assert.equal((await listPublicationStates(db))[0].pending, 1);
    const request = async (url, options) => {
      assert.equal(url, `${config.url}/rest/v1/rpc/publish_catalog_product`);
      assert.equal(options?.method, 'POST');
      const body = JSON.parse(String(options?.body));
      assert.match(body.p_write_token, /^[0-9a-f]{64}$/);
      assert.match(body.p_id, /^[0-9a-f-]{36}$/);
      assert.equal(body.p_product.verification, 'user_entered');
      assert.equal(body.p_product.verified_at, null);
      return new Response(JSON.stringify(body.p_id));
    };
    assert.equal(await flushPublications(db, config, request), 1);
    assert.equal((await listPublicationStates(db))[0].pending, 0);
    assert.equal((await getProduct(db, id)).name, fixture().name);
  } finally {
    native.close();
  }
});
test('public serialization excludes personal fields and does not claim verification', () => {
  const data = {
    ...fixture(),
    verification: 'source_checked',
    verified_at: '2026-11-15',
    quantity: 99,
    batch: 'PRIVATE',
    raw: 'PRIVATE SCAN',
    serial: 'PRIVATE',
    source: 'User-reviewed packaging scan #42; not independently verified',
  };
  const result = publicProduct(data);
  const json = JSON.stringify(result);
  assert.doesNotMatch(json, /PRIVATE|quantity|#42/);
  assert.equal(result.verification, 'user_entered');
  assert.equal(result.verified_at, null);
});
test('offline failures retain a durable pending save and retries reuse credentials', async () => {
  const { db, native } = await database();
  try {
    await saveProduct(db, fixture(), undefined, 'own', config.url);
    let first = '';
    await flushPublications(db, config, async (_url, options) => {
      first = String(options?.body);
      throw new Error('offline');
    });
    assert.equal((await listPublicationStates(db))[0].pending, 1);
    assert.match((await listPublicationStates(db))[0].last_error, /offline/);
    await flushPublications(db, config, async (_url, options) => {
      assert.equal(options?.body, first);
      return new Response(JSON.stringify(JSON.parse(first).p_id));
    });
    assert.equal((await listPublicationStates(db))[0].pending, 0);
  } finally {
    native.close();
  }
});
test('editing reuses the original remote identity and device write token', async () => {
  const { db, native } = await database();
  try {
    const id = await saveProduct(db, fixture(), undefined, 'own', config.url);
    const first = await db.getFirstAsync('SELECT remote_id,write_token FROM product_publications');
    await flushPublications(db, config, ack);
    await saveProduct(
      db,
      { ...fixture(), name: 'Edited synthetic product' },
      id,
      'own',
      config.url,
    );
    assert.deepEqual(
      await db.getFirstAsync('SELECT remote_id,write_token FROM product_publications'),
      first,
    );
    assert.equal((await listPublicationStates(db))[0].pending, 1);
    await flushPublications(db, config, ack);
    assert.equal((await listPublicationStates(db))[0].pending, 0);
  } finally {
    native.close();
  }
});
test('a lost acknowledgement leaves the same publication queued for idempotent retry', async () => {
  const { db, native } = await database();
  try {
    await saveProduct(db, fixture(), undefined, 'own', config.url);
    await flushPublications(db, config, async () => new Response('"wrong-id"'));
    assert.equal((await listPublicationStates(db))[0].pending, 1);
    await flushPublications(db, config, ack);
    assert.equal((await listPublicationStates(db))[0].pending, 0);
  } finally {
    native.close();
  }
});
test('missing RPC setup is explained without losing the local product', async () => {
  const { db, native } = await database();
  try {
    await saveProduct(db, fixture(), undefined, 'own', config.url);
    await flushPublications(db, config, async () => new Response('{}', { status: 404 }));
    assert.match((await listPublicationStates(db))[0].last_error, /migration 002/);
    assert.equal((await listProducts(db)).length, 1);
  } finally {
    native.close();
  }
});
test('a barcode conflict does not prevent the next queued product from uploading', async () => {
  const { db, native } = await database();
  try {
    await saveProduct(db, fixture(), undefined, 'own', config.url);
    await saveProduct(
      db,
      { ...fixture(), name: 'Second synthetic product', barcodes: ['SECOND-TEST'] },
      undefined,
      'own',
      config.url,
    );
    let count = 0;
    await flushPublications(db, config, async (url, options) =>
      ++count === 1
        ? new Response(
            JSON.stringify({
              message: 'This barcode is already associated with another shared product',
            }),
            { status: 400 },
          )
        : ack(url, options),
    );
    const states = await listPublicationStates(db);
    assert.equal(states.filter((s) => s.pending).length, 1);
    assert.match(states.find((s) => s.pending).last_error, /barcode already/);
    assert.equal(states.filter((s) => !s.pending).length, 1);
  } finally {
    native.close();
  }
});
test('new edits during an upload remain pending after an older acknowledgement', async () => {
  const { db, native } = await database();
  try {
    const id = await saveProduct(db, fixture(), undefined, 'own', config.url);
    await flushPublications(db, config, async (url, options) => {
      await saveProduct(db, { ...fixture(), name: 'Newer correction' }, id, 'own', config.url);
      return ack(url, options);
    });
    assert.equal((await listPublicationStates(db))[0].pending, 1);
    assert.equal((await getProduct(db, id)).name, 'Newer correction');
  } finally {
    native.close();
  }
});
test('local product and queue both roll back if queue creation fails', async () => {
  const { db, native } = await database();
  try {
    native.exec(
      "CREATE TRIGGER fail_queue BEFORE INSERT ON product_publications BEGIN SELECT RAISE(ABORT,'synthetic queue failure'); END;",
    );
    await assert.rejects(
      saveProduct(db, fixture(), undefined, 'own', config.url),
      /synthetic queue failure/,
    );
    assert.equal((await listProducts(db)).length, 0);
  } finally {
    native.close();
  }
});
test('ordinary local saves and catalog downloads never create an upload loop', async () => {
  const { db, native } = await database();
  try {
    await saveProduct(db, fixture());
    await downloadCatalog(
      db,
      config,
      async () =>
        new Response(
          JSON.stringify([
            {
              id: '11111111-1111-4111-8111-111111111111',
              updated_at: '2026-11-15T00:00:00Z',
              status: 'community',
              product: { ...fixture(), barcodes: ['OTHER-TEST'] },
            },
          ]),
        ),
    );
    assert.equal((await listPublicationStates(db)).length, 0);
    assert.equal((await listProducts(db))[1].verification, 'user_entered');
  } finally {
    native.close();
  }
});
test('a newly identified medicine queues its product but excludes the personal package', async () => {
  const { db, native } = await database();
  try {
    const id = await beginIdentification(
      db,
      'Product: Syntheticmed 500mg\nBatch: PRIVATEBATCH\nSerial: PRIVATE-SERIAL\nEXP: 01/2028',
      'qr',
      'test-share',
    );
    const accepted = await acceptIdentity(db, id, { name: 'Syntheticmed', strength: '500mg' });
    await saveIdentification(db, id, accepted.reviewed, {
      packageChecked: true,
      conflictChecked: false,
      quantity: 2,
      unit: 'units',
      shareProject: config.url,
    });
    const queued = await db.getFirstAsync('SELECT payload FROM product_publications');
    assert.ok(queued);
    assert.doesNotMatch(queued.payload, /PRIVATE|quantity|scan #/);
    assert.equal((await db.getFirstAsync('SELECT count(*) n FROM user_medicines')).n, 1);
  } finally {
    native.close();
  }
});
test('recovery queues unshared local products once and preserves existing publication credentials', async () => {
  const { db, native } = await database();
  try {
    const old = await saveProduct(db, fixture());
    const { queueExistingLocalProducts } = await import('../src/data/products.js');
    assert.equal(await queueExistingLocalProducts(db, config.url), 1);
    const first = await db.getFirstAsync(
      'SELECT remote_id,write_token FROM product_publications WHERE product_id=?',
      old,
    );
    assert.equal(await queueExistingLocalProducts(db, config.url), 0);
    assert.deepEqual(
      await db.getFirstAsync(
        'SELECT remote_id,write_token FROM product_publications WHERE product_id=?',
        old,
      ),
      first,
    );
    await flushPublications(db, config, ack);
    assert.equal((await listPublicationStates(db))[0].pending, 0);
    assert.equal(await queueExistingLocalProducts(db, config.url), 0);
  } finally {
    native.close();
  }
});
test('recovery excludes downloaded records and does not upload private inventory data', async () => {
  const { db, native } = await database();
  try {
    const local = await saveProduct(db, fixture());
    await db.runAsync(
      'INSERT INTO user_medicines(product_id,quantity,batch) VALUES (?,?,?)',
      local,
      4,
      'PRIVATEBATCH',
    );
    await downloadCatalog(
      db,
      config,
      async () =>
        new Response(
          JSON.stringify([
            {
              id: '11111111-1111-4111-8111-111111111111',
              updated_at: '2026-11-15T00:00:00Z',
              status: 'community',
              product: { ...fixture(), barcodes: ['DOWNLOADED-TEST'] },
            },
          ]),
        ),
    );
    const { queueExistingLocalProducts } = await import('../src/data/products.js');
    assert.equal(await queueExistingLocalProducts(db, config.url), 1);
    const rows = await db.getAllAsync('SELECT product_id,payload FROM product_publications');
    assert.equal(rows[0].product_id, local);
    assert.doesNotMatch(rows[0].payload, /PRIVATEBATCH|quantity/);
    assert.equal(rows.length, 1);
  } finally {
    native.close();
  }
});
