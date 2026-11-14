import { database } from './helpers/database';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrate } from '../src/data/schema';
import { saveProduct, listProducts, getProduct, findProduct } from '../src/data/products';
import { saveInventory, listInventory } from '../src/data/inventory';
import { recordScan, listHistory } from '../src/data/history';
import { decodeScan } from '../src/domain/scan';
import type { ProductInput } from '../src/domain/types';
const fixture = (name = 'Test product'): ProductInput => ({
  name,
  generic_name: 'Example ingredient',
  strength: '1 test unit',
  dosage_form: 'Test form',
  manufacturer: 'Test manufacturer',
  country: 'Test country',
  category: 'Test category',
  pack_size: 'Test pack',
  storage: '',
  warnings: '',
  indications: '',
  prescription: '',
  source: 'Synthetic automated test fixture — not medicine information',
  verified_at: null,
  verification: 'user_entered',
  ingredients: [{ name: 'Example ingredient', strength: '1 test unit' }],
  barcodes: ['TEST-PACK-A'],
});
test('migration is idempotent and enables referential integrity', async () => {
  const { db, native } = await database();
  try {
    await migrate(db);
    assert.equal(
      (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version,
      4,
    );
    assert.throws(() => native.exec("INSERT INTO barcodes VALUES ('ORPHAN',999)"));
  } finally {
    native.close();
  }
});
test('registration, ingredient search and exact identifier lookup use SQL', async () => {
  const { db, native } = await database();
  try {
    const id = await saveProduct(db, fixture());
    assert.equal((await findProduct(db, 'TEST-PACK-A'))?.id, id);
    assert.equal((await listProducts(db, 'example ingredient')).length, 1);
    assert.equal((await listProducts(db, '', 'Other category')).length, 0);
    assert.equal((await listProducts(db, '', 'All', 'Test manufacturer')).length, 1);
    assert.equal((await getProduct(db, id))?.ingredients[0].name, 'example ingredient');
    assert.equal(await findProduct(db, 'UNKNOWN'), null);
  } finally {
    native.close();
  }
});
test('duplicate identifiers roll back without damaging an existing product', async () => {
  const { db, native } = await database();
  try {
    const id = await saveProduct(db, fixture('First'));
    await assert.rejects(saveProduct(db, fixture('Second')), /already associated/);
    assert.equal((await listProducts(db)).length, 1);
    assert.equal((await getProduct(db, id))?.name, 'First');
    const bad = {
      ...fixture('Edited'),
      ingredients: [{ name: 'Bad', strength: null as any }],
    };
    await assert.rejects(saveProduct(db, bad, id));
    assert.equal((await getProduct(db, id))?.name, 'First');
    assert.deepEqual((await getProduct(db, id))?.barcodes, ['TEST-PACK-A']);
  } finally {
    native.close();
  }
});
test('pack expiry precision, unknown dates and quantity validation persist', async () => {
  const { db, native } = await database();
  try {
    const product_id = await saveProduct(db, fixture());
    const input = {
      product_id,
      quantity: 10,
      unit: 'test units',
      batch: 'B1',
      expiry: '2028-02',
      expiry_source: 'Test input',
    };
    await saveInventory(db, input);
    await saveInventory(db, { ...input, expiry: '' });
    const rows = await listInventory(db);
    assert.equal(rows[0].expiry, '2028-02-29');
    assert.equal(rows[0].expiry_precision, 'month');
    assert.equal(rows[1].expiry, null);
    assert.equal(rows[1].expiry_precision, 'unknown');
    await assert.rejects(saveInventory(db, { ...input, quantity: -1 }));
    await assert.rejects(saveInventory(db, { ...input, expiry: '2027-02-30' }));
  } finally {
    native.close();
  }
});
test('history records unknown URLs without assigning a product', async () => {
  const { db, native } = await database();
  try {
    await recordScan(db, decodeScan('https://example.com/unknown', 'qr'), null);
    const rows = await listHistory(db);
    assert.equal(rows[0].status, 'Website QR');
    assert.equal(rows[0].product_id, null);
    assert.equal((await listHistory(db, 'example.com')).length, 1);
  } finally {
    native.close();
  }
});
