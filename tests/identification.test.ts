import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { database } from './helpers/database';
import {
  acceptIdentity,
  beginIdentification,
  getSession,
  persistReview,
  rejectIdentity,
  saveIdentification,
} from '../src/data/identification';
import { editField } from '../src/domain/extraction/verification';
import { extractMedicine } from '../src/domain/extraction/engine';
import { listTemplates } from '../src/data/templates';
import { listInventory } from '../src/data/inventory';
import { getProduct, listProducts, saveProduct } from '../src/data/products';
import { expiryState } from '../src/domain/expiry';
import { schema } from '../src/data/schema';
import type { ProductInput } from '../src/domain/types';
const raw =
  'Product: Alphamed 500mg\nIngredients: Example ingredient 500mg\nManufacturer: Payload Pharma Ltd\nBatch: AB1\nMFG: 01/2020\nEXP: 01/2021\nSerial: SERIAL1';
const options = { packageChecked: true, conflictChecked: false, quantity: 2, unit: 'test units' };
const fixture = (name = 'Catalogmed', barcode = 'TEST-CODE'): ProductInput => ({
  name,
  strength: '500mg',
  dosage_form: 'Tablet',
  generic_name: 'Example ingredient',
  manufacturer: 'Original catalog manufacturer',
  manufacturer_address: 'Original catalog address',
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
  ingredients: [{ name: 'Example ingredient', strength: '500mg' }],
  barcodes: [barcode],
});
test('scan token is idempotent and unconfirmed details cannot be saved', async () => {
  const { db, native } = await database();
  try {
    const id = await beginIdentification(db, raw, 'qr', 'one');
    assert.equal(await beginIdentification(db, raw, 'qr', 'one'), id);
    assert.equal(
      (await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) n FROM scan_history'))!.n,
      1,
    );
    const s = (await getSession(db, id))!;
    assert.equal(s.state, 'pending');
    assert.equal(s.reviewed, null);
    assert.equal(s.identity, null);
    await assert.rejects(saveIdentification(db, id, s.original, options), /Confirm/);
    await assert.rejects(beginIdentification(db, 'different', 'qr', 'one'), /token/);
  } finally {
    native.close();
  }
});
test('confirmation, individual corrections and saving preserve raw evidence and package precision', async () => {
  const { db, native } = await database();
  try {
    const id = await beginIdentification(db, raw, 'qr', 'two');
    const s = await acceptIdentity(db, id, { name: 'Alphamed', strength: '500mg' });
    assert.equal(s.reviewed!.fields.expiryDate.verification, 'unverified');
    assert.equal(s.reviewed!.fields.activeIngredients.verification, 'unverified');
    const edited = editField(s.reviewed!, 'batchNumber', 'CORRECTED');
    await persistReview(db, id, edited);
    await assert.rejects(
      saveIdentification(db, id, edited, { ...options, packageChecked: false }),
      /physical packaging/,
    );
    const packageId = await saveIdentification(db, id, edited, options);
    const row = (await listInventory(db))[0];
    assert.equal(row.id, packageId);
    assert.equal(row.expiry, '2021-01-31');
    assert.equal(row.expiry_precision, 'month');
    assert.equal(row.manufacturing_date, '2020-01');
    assert.equal(row.serial_number, 'SERIAL1');
    assert.equal(expiryState(row.expiry, new Date(2026, 0, 1)), 'Expired');
    const stored = (await getSession(db, id))!;
    assert.equal(stored.state, 'saved');
    assert.equal(stored.original.raw, raw);
    assert.equal(stored.original.fields.batchNumber.value, 'AB1');
    assert.equal(stored.reviewed!.fields.batchNumber.value, 'CORRECTED');
    assert.equal(stored.reviewed!.fields.expiryDate.verification, 'user_confirmed');
    assert.equal(stored.reviewed!.fields.activeIngredients.verification, 'unverified');
    assert.equal((await getProduct(db, row.product_id))!.verification, 'user_entered');
    assert.equal(await saveIdentification(db, id, edited, options), packageId);
    assert.equal((await listInventory(db)).length, 1);
  } finally {
    native.close();
  }
});
test('rejecting and manually replacing identity discards product-specific predictions', async () => {
  const { db, native } = await database();
  try {
    const id = await beginIdentification(db, raw, 'qr', 'three');
    await rejectIdentity(db, id);
    const rejected = (await getSession(db, id))!;
    assert.equal(rejected.state, 'rejected');
    assert.equal(rejected.reviewed, null);
    const s = await acceptIdentity(db, id, { name: 'Betamed', strength: '250mg' });
    assert.equal(s.reviewed!.fields.productName.value, 'Betamed');
    assert.equal(s.reviewed!.fields.activeIngredients.value, null);
    assert.equal(s.reviewed!.fields.manufacturer.value, null);
    assert.equal(s.original.fields.manufacturer.value, 'Payload Pharma Ltd');
    await saveIdentification(db, id, s.reviewed!, options);
    const product = (await listProducts(db))[0];
    assert.equal(product.name, 'Betamed');
    assert.equal(product.manufacturer, '');
    assert.deepEqual(product.ingredients, []);
  } finally {
    native.close();
  }
});
test('alternative local identity is looked up again and existing catalog is not overwritten', async () => {
  const { db, native } = await database();
  try {
    const a = await saveProduct(db, fixture('Catalogmed', '4006381333931'));
    const b = await saveProduct(db, {
      ...fixture('Betamed', 'OTHER-CODE'),
      manufacturer: 'Replacement manufacturer',
    });
    const id = await beginIdentification(db, '4006381333931', 'ean13', 'four');
    await rejectIdentity(db, id);
    const s = await acceptIdentity(db, id, { productId: b });
    assert.equal(s.identity!.override, true);
    assert.equal(s.reviewed!.fields.manufacturer.value, 'Replacement manufacturer');
    await assert.rejects(saveIdentification(db, id, s.reviewed!, options), /conflict/);
    await saveIdentification(db, id, s.reviewed!, { ...options, conflictChecked: true });
    assert.equal((await listProducts(db)).length, 2);
    assert.equal((await getProduct(db, a))!.name, 'Catalogmed');
    assert.equal((await getProduct(db, b))!.manufacturer, 'Replacement manufacturer');
    assert.deepEqual((await getProduct(db, a))!.barcodes, ['04006381333931']);
  } finally {
    native.close();
  }
});
test('chronologically inconsistent dates block saving and failed writes roll back new catalog records', async () => {
  const { db, native } = await database();
  try {
    const id = await beginIdentification(
      db,
      'Product: Rollbackmed\nMFG: 2028-03\nEXP: 2028-01',
      'qr',
      'five',
    );
    const s = await acceptIdentity(db, id, { name: 'Rollbackmed' });
    await assert.rejects(saveIdentification(db, id, s.reviewed!, options), /later than expiry/);
    assert.equal((await listProducts(db)).length, 0);
    const fixed = editField(s.reviewed!, 'manufacturingDate', '2020-01');
    await assert.rejects(
      saveIdentification(db, id, fixed, { ...options, quantity: NaN }),
      /Quantity/,
    );
    assert.equal((await listProducts(db)).length, 0);
    assert.equal((await getSession(db, id))!.state, 'identity_confirmed');
  } finally {
    native.close();
  }
});
test('a repeated serialized pack links to existing inventory without increasing quantity', async () => {
  const { db, native } = await database();
  try {
    const id = await beginIdentification(db, raw, 'qr', 'six-a');
    const s = await acceptIdentity(db, id, { name: 'Alphamed', strength: '500mg' });
    const packageId = await saveIdentification(db, id, s.reviewed!, options);
    const next = await beginIdentification(db, raw, 'qr', 'six-b');
    const second = await acceptIdentity(db, next, { productId: (await listProducts(db))[0].id });
    assert.equal(
      await saveIdentification(db, next, second.reviewed!, { ...options, quantity: 99 }),
      packageId,
    );
    assert.equal((await listInventory(db))[0].quantity, 2);
    assert.equal((await listInventory(db)).length, 1);
    assert.equal(
      (await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) n FROM scan_history'))!.n,
      2,
    );
  } finally {
    native.close();
  }
});
test('similar non-serialized packs require a deliberate duplicate choice', async () => {
  const { db, native } = await database();
  try {
    const data = 'Product: Alphamed\nBatch: SAME\nEXP: 2028-01';
    const id = await beginIdentification(db, data, 'qr', 'seven-a');
    const first = await acceptIdentity(db, id, { name: 'Alphamed' });
    const packageId = await saveIdentification(db, id, first.reviewed!, options);
    const next = await beginIdentification(db, data, 'qr', 'seven-b');
    const second = await acceptIdentity(db, next, { productId: (await listProducts(db))[0].id });
    await assert.rejects(saveIdentification(db, next, second.reviewed!, options), /similar pack/);
    assert.equal(
      await saveIdentification(db, next, second.reviewed!, {
        ...options,
        duplicateChoice: packageId,
      }),
      packageId,
    );
    assert.equal((await listInventory(db)).length, 1);
  } finally {
    native.close();
  }
});
test('previous exact reviewed payload can identify custom formats but manual expiry is never copied between packs', async () => {
  const { db, native } = await database();
  try {
    const data = 'TradeLabel: Alphamed';
    const id = await beginIdentification(db, data, 'qr', 'eight-a');
    const first = await acceptIdentity(db, id, { name: 'Alphamed' });
    const edited = editField(first.reviewed!, 'expiryDate', '2028-01');
    await saveIdentification(db, id, edited, options);
    const next = await beginIdentification(db, data, 'qr', 'eight-b');
    const s = (await getSession(db, next))!;
    assert.equal(s.original.fields.productName.value, 'Alphamed');
    assert.equal(s.original.fields.expiryDate.value, null);
    assert.equal(s.state, 'pending');
  } finally {
    native.close();
  }
});
test('adaptive mappings need distinct payloads and are reused only for exact signatures', async () => {
  const { db, native } = await database();
  try {
    async function review(name: string, date: string, token: string) {
      const data = `TradeText: ${name} 500mg\nDateStamp: ${date}`;
      const id = await beginIdentification(db, data, 'qr', token);
      let s = await acceptIdentity(db, id, { name, strength: '500mg' });
      const tokenDate = s.reviewed!.tokens.find((t) => t.label === 'DateStamp')!;
      const reviewed = editField(s.reviewed!, 'expiryDate', tokenDate.raw, tokenDate);
      await saveIdentification(db, id, reviewed, { ...options, duplicateChoice: 'new' });
      return data;
    }
    const one = await review('Alphamed', '01/2028', 'nine-a');
    let templates = await listTemplates(db);
    assert.equal(templates[0].verification, 'candidate');
    assert.equal(templates[0].confirmations, 1);
    await review('Alphamed', '01/2028', 'nine-a2');
    templates = await listTemplates(db);
    assert.equal(templates[0].confirmations, 1);
    await review('Betamed', '02/2029', 'nine-b');
    templates = await listTemplates(db);
    assert.equal(templates[0].verification, 'locally_confirmed');
    assert.equal(templates[0].confirmations, 2);
    const predicted = extractMedicine('TradeText: Gammamed 500mg\nDateStamp: 03/2030', 'qr', {
      products: [],
      templates,
    });
    assert.equal(predicted.fields.productName.value, 'Gammamed');
    assert.equal(predicted.fields.expiryDate.value, '2030-03');
    assert.equal(predicted.fields.expiryDate.verification, 'unverified');
    assert.equal(predicted.templateId, templates[0].id);
    const different = extractMedicine('OtherTrade: Gammamed 500mg\nDateStamp: 03/2030', 'qr', {
      products: [],
      templates,
    });
    assert.equal(different.templateId, null);
    assert.equal(different.fields.productName.value, null);
    assert.ok(one);
  } finally {
    native.close();
  }
});
test('offline database persistence survives closing and reopening the connection', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'medtrace-identification-'));
  try {
    const file = join(dir, 'test.db');
    const first = await database(file);
    const id = await beginIdentification(first.db, raw, 'qr', 'ten');
    const s = await acceptIdentity(first.db, id, { name: 'Alphamed', strength: '500mg' });
    await saveIdentification(first.db, id, s.reviewed!, options);
    first.native.close();
    const second = await database(file);
    try {
      assert.equal((await getSession(second.db, id))!.state, 'saved');
      assert.equal((await listInventory(second.db))[0].serial_number, 'SERIAL1');
      assert.equal((await listProducts(second.db))[0].name, 'Alphamed');
    } finally {
      second.native.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('version two migration preserves an existing medicine, stock and legacy scan', async () => {
  const { db, native } = await database(':memory:', (n) => {
    n.exec(schema);
    n.exec(
      "CREATE TABLE preferences(key TEXT PRIMARY KEY,value TEXT NOT NULL); PRAGMA user_version=2; INSERT INTO products(id,name) VALUES(1,'Existing product'); INSERT INTO user_medicines(product_id,quantity) VALUES(1,3); INSERT INTO scan_history(raw,format,status) VALUES('OLD','qr','Unknown product');",
    );
  });
  try {
    assert.equal((await listProducts(db))[0].name, 'Existing product');
    assert.equal((await listInventory(db))[0].quantity, 3);
    assert.equal(
      (await db.getFirstAsync<{ verification_status: string }>(
        'SELECT verification_status FROM scan_history',
      ))!.verification_status,
      'legacy',
    );
    assert.equal(
      (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))!.user_version,
      3,
    );
  } finally {
    native.close();
  }
});
