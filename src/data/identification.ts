import type { SQLiteDatabase } from 'expo-sqlite';
import type { ProductInput } from '../domain/types';
import { extractMedicine } from '../domain/extraction/engine';
import {
  copyExtraction,
  confirmIdentity,
  matchesIdentity,
  validateReview,
  verifyField,
} from '../domain/extraction/verification';
import {
  type DetectedIngredient as Ingredient,
  fieldKeys,
  packageKeys,
  type Extraction,
  type Identity,
  type Session,
} from '../domain/extraction/types';
import {
  nameOf,
  normalizeName,
  normalizeForm,
  strengthOf,
  formOf,
} from '../domain/extraction/text';
import { parseExpiry } from '../domain/expiry';
import { findProduct, getProduct, listProducts, saveProduct } from './products';
import { listTemplates, learnTemplate } from './templates';
import { saveInventory } from './inventory';

type SessionRow = {
  id: number;
  raw: string;
  format: string;
  verification_status: Session['state'];
  extraction_data: string;
  reviewed_data: string | null;
  identity_json: string | null;
  package_id: number | null;
  rejection_count: number;
};
export function parseExtraction(encoded: string): Extraction {
  if (encoded.length > 150000) throw new Error('Stored extraction is too large.');
  const data: unknown = JSON.parse(encoded);
  if (!data || typeof data !== 'object') throw new Error('Stored extraction is invalid.');
  const r = data as Extraction;
  if (
    r.version !== 1 ||
    typeof r.raw !== 'string' ||
    r.raw.length > 4096 ||
    typeof r.format !== 'string' ||
    !r.fields ||
    !Array.isArray(r.tokens) ||
    r.tokens.length > 40 ||
    !Array.isArray(r.issues) ||
    !Array.isArray(r.candidates) ||
    !Array.isArray(r.additionalInformation)
  )
    throw new Error('Stored extraction is invalid.');
  for (const key of fieldKeys) {
    const f = r.fields[key];
    if (
      !f ||
      typeof f !== 'object' ||
      !['missing', 'unverified', 'user_confirmed', 'source_checked'].includes(f.verification)
    )
      throw new Error('Stored field evidence is invalid.');
    if (f.value !== null) {
      if (key === 'activeIngredients') {
        if (
          !Array.isArray(f.value) ||
          f.value.length > 30 ||
          !(f.value as Ingredient[]).every(
            (i) =>
              typeof i.name === 'string' && (i.strength === null || typeof i.strength === 'string'),
          )
        )
          throw new Error('Stored ingredients are invalid.');
      } else if (typeof f.value !== 'string') throw new Error('Stored field value is invalid.');
    }
  }
  return r;
}
export async function getSession(db: SQLiteDatabase, id: number): Promise<Session | null> {
  const row = await db.getFirstAsync<SessionRow>(
    'SELECT * FROM scan_history WHERE id=? AND extraction_data IS NOT NULL',
    id,
  );
  if (!row) return null;
  return {
    id: row.id,
    raw: row.raw,
    format: row.format,
    state: row.verification_status,
    original: parseExtraction(row.extraction_data),
    reviewed: row.reviewed_data ? parseExtraction(row.reviewed_data) : null,
    identity: row.identity_json ? (JSON.parse(row.identity_json) as Identity) : null,
    packageId: row.package_id,
    rejectionCount: row.rejection_count,
  };
}
export async function beginIdentification(
  db: SQLiteDatabase,
  raw: string,
  format: string,
  token: string,
): Promise<number> {
  if (raw.length > 4096)
    throw new Error(
      'The code is too long. Scan another code or enter the medicine identity manually.',
    );
  if (!token || token.length > 120) throw new Error('Invalid scan session token.');
  const existing = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM scan_history WHERE scan_token=?',
    token,
  );
  if (existing) {
    const session = await getSession(db, existing.id);
    if (!session || session.raw !== raw || session.format !== format)
      throw new Error('Scan token does not match this payload.');
    return existing.id;
  }
  const previous = await db.getFirstAsync<{ reviewed_data: string; product_id: number | null }>(
    "SELECT reviewed_data,product_id FROM scan_history WHERE raw=? AND format=? AND verification_status='saved' ORDER BY id DESC LIMIT 1",
    raw,
    format,
  );
  let known: { extraction: Extraction; productId: number | null } | undefined;
  if (previous?.reviewed_data) {
    try {
      known = {
        extraction: parseExtraction(previous.reviewed_data),
        productId: previous.product_id,
      };
    } catch {
      /* A damaged old snapshot never blocks a fresh offline extraction. */
    }
  }
  const result = extractMedicine(raw, format, {
    products: await listProducts(db),
    templates: await listTemplates(db),
    previous: known,
  });
  const r = await db.runAsync(
    'INSERT INTO scan_history(raw,format,identifier,status,notes,extraction_data,verification_status,scan_token) VALUES (?,?,?,?,?,?,?,?)',
    raw,
    format,
    result.fields.gtin.value,
    'Awaiting confirmation',
    result.issues.join('\n'),
    JSON.stringify(result),
    'pending',
    token,
  );
  return r.lastInsertRowId;
}
export async function rejectIdentity(db: SQLiteDatabase, id: number) {
  const session = await getSession(db, id);
  if (!session || session.state === 'saved')
    throw new Error('This identification cannot be changed. Start a new scan.');
  await db.runAsync(
    "UPDATE scan_history SET verification_status='rejected',status='Identity rejected',reviewed_data=NULL,identity_json=NULL,product_id=NULL,batch=NULL,expiry=NULL,serial=NULL,rejection_count=rejection_count+1 WHERE id=?",
    id,
  );
}
export async function acceptIdentity(
  db: SQLiteDatabase,
  id: number,
  input: { productId?: number | null; name?: string; strength?: string; dosageForm?: string },
): Promise<Session> {
  const session = await getSession(db, id);
  if (!session || session.state === 'saved')
    throw new Error('This identification cannot be changed. Start a new scan.');
  let product = input.productId ? await getProduct(db, input.productId) : null;
  if (input.productId && !product) throw new Error('The selected product is no longer available.');
  const enteredName = input.name?.trim() ?? session.original.fields.productName.value ?? '';
  const name =
    product?.name ?? (strengthOf(enteredName) ? nameOf(enteredName) : enteredName.trim()) ?? '';
  const strength = product?.strength || input.strength?.trim() || strengthOf(enteredName) || null;
  const dosageForm =
    product?.dosage_form || input.dosageForm?.trim() || formOf(enteredName) || null;
  if (!name || name.length > 160)
    throw new Error('Enter the medicine name printed on the packaging.');
  const initial: Identity = {
    productId: product?.id ?? null,
    name,
    strength,
    dosageForm,
    override: false,
  };
  if (!product) {
    const same = (await listProducts(db)).filter((p) => matchesIdentity(p, initial));
    if (same.length > 1)
      throw new Error(
        'Several local products match this identity. Select the exact product and pack variant.',
      );
    if (same.length === 1) {
      product = same[0];
      initial.productId = product.id;
    }
  }
  const bound = session.original.fields.gtin.value
    ? await findProduct(db, session.original.fields.gtin.value)
    : null;
  initial.override = Boolean(bound && bound.id !== initial.productId);
  const changed =
    session.rejectionCount > 0 ||
    session.original.predictedProductId !== initial.productId ||
    normalizeName(session.original.fields.productName.value ?? '') !== normalizeName(name) ||
    (session.original.fields.strength.value ?? '').toLowerCase().replace(/\s/g, '') !==
      (strength ?? '').toLowerCase().replace(/\s/g, '') ||
    normalizeForm(session.original.fields.dosageForm.value ?? '') !==
      normalizeForm(dosageForm ?? '');
  const reviewed = confirmIdentity(session.original, initial, product, changed);
  if (initial.override) reviewed.identityConflict = true;
  await db.runAsync(
    "UPDATE scan_history SET verification_status='identity_confirmed',status='User-confirmed identity',identity_json=?,reviewed_data=?,product_id=?,batch=?,expiry=?,serial=? WHERE id=?",
    JSON.stringify(initial),
    JSON.stringify(reviewed),
    product?.id ?? null,
    reviewed.fields.batchNumber.value,
    reviewed.fields.expiryDate.value,
    reviewed.fields.serialNumber.value,
    id,
  );
  return (await getSession(db, id))!;
}
export async function persistReview(db: SQLiteDatabase, id: number, reviewed: Extraction) {
  const session = await getSession(db, id);
  if (!session || session.state !== 'identity_confirmed' || !session.identity)
    throw new Error('Confirm the medicine identity before reviewing fields.');
  parseExtraction(JSON.stringify(reviewed));
  if (reviewed.raw !== session.raw || reviewed.format !== session.format)
    throw new Error('Original scan content cannot be changed.');
  if (
    ['productName', 'strength', 'dosageForm'].some(
      (k) =>
        JSON.stringify(reviewed.fields[k as 'productName'].value) !==
        JSON.stringify(session.reviewed!.fields[k as 'productName'].value),
    )
  )
    throw new Error('Use Change medicine identity to correct its name or strength.');
  const owner = reviewed.fields.gtin.value
    ? await findProduct(db, reviewed.fields.gtin.value)
    : null;
  if (owner && owner.id !== session.identity.productId) reviewed.identityConflict = true;
  await db.runAsync(
    'UPDATE scan_history SET reviewed_data=? WHERE id=?',
    JSON.stringify(reviewed),
    id,
  );
  return reviewed;
}
export type SaveReviewOptions = {
  packageChecked: boolean;
  conflictChecked: boolean;
  quantity: number;
  unit: string;
  duplicateChoice?: number | 'new';
};
export async function saveIdentification(
  db: SQLiteDatabase,
  id: number,
  reviewed: Extraction,
  options: SaveReviewOptions,
): Promise<number> {
  const session = await getSession(db, id);
  if (!session) throw new Error('Scan session not found.');
  if (session.state === 'saved') {
    if (session.packageId) return session.packageId;
    throw new Error(
      'This scan was saved previously, but its inventory entry was removed. Start another scan to add a pack.',
    );
  }
  if (session.state !== 'identity_confirmed' || !session.identity)
    throw new Error('Confirm the medicine identity before saving.');
  parseExtraction(JSON.stringify(reviewed));
  if (reviewed.raw !== session.raw || reviewed.format !== session.format)
    throw new Error('Original scan content cannot be changed.');
  const currentOwner = reviewed.fields.gtin.value
    ? await findProduct(db, reviewed.fields.gtin.value)
    : null;
  if (currentOwner && currentOwner.id !== session.identity.productId && !options.conflictChecked)
    throw new Error(
      'The barcode belongs to another local product. Acknowledge the conflict or correct the identifier.',
    );
  const errors = validateReview(
    reviewed,
    session.identity,
    options.packageChecked,
    options.conflictChecked,
  );
  if (errors.length) throw new Error(errors.join('\n'));
  const final = copyExtraction(reviewed);
  for (const key of packageKeys) {
    const confirmed = verifyField(final, key);
    final.fields = confirmed.fields;
  }
  let packageId = 0;
  await db.withTransactionAsync(async () => {
    let productId = session.identity!.productId;
    if (productId) {
      const product = await getProduct(db, productId);
      if (!product || !matchesIdentity(product, session.identity!))
        throw new Error('The library product changed. Confirm its identity again before saving.');
    } else {
      const barcode = final.fields.gtin.value,
        owner = barcode ? await findProduct(db, barcode) : null;
      const input: ProductInput = {
        name: session.identity!.name,
        strength: session.identity!.strength ?? '',
        dosage_form: session.identity!.dosageForm ?? '',
        generic_name: final.fields.activeIngredients.value?.map((i) => i.name).join(', ') ?? '',
        manufacturer: final.fields.manufacturer.value ?? '',
        manufacturer_address: final.fields.manufacturerAddress.value ?? '',
        ingredients:
          final.fields.activeIngredients.value?.map((i) => ({
            name: i.name,
            strength: i.strength ?? '',
          })) ?? [],
        barcodes: barcode && !owner ? [barcode] : [],
        country: '',
        category: 'Uncategorised',
        pack_size: '',
        storage: '',
        warnings: '',
        indications: '',
        prescription: '',
        source: `User-reviewed packaging scan #${id}; not independently verified`,
        verified_at: null,
        verification: 'user_entered',
      };
      productId = await saveProduct(db, input, undefined, 'existing');
    }
    const barcode = final.fields.gtin.value;
    if (barcode) {
      const owner = await findProduct(db, barcode);
      if (!owner)
        await db.runAsync(
          'INSERT INTO barcodes(identifier,product_id,source_scan_id) VALUES (?,?,?)',
          barcode,
          productId,
          id,
        );
      if (owner?.id === productId || !owner)
        await db.runAsync(
          'UPDATE barcodes SET source_scan_id=COALESCE(source_scan_id,?) WHERE identifier=? AND product_id=?',
          id,
          barcode,
          productId,
        );
    }
    const serial = final.fields.serialNumber.value ?? '',
      batch = final.fields.batchNumber.value ?? '',
      expiry = final.fields.expiryDate.value;
    const parsedExpiry = parseExpiry(expiry ?? '');
    const bySerial = serial
      ? await db.getFirstAsync<{
          id: number;
          batch: string;
          expiry: string | null;
          manufacturing_date: string | null;
        }>(
          'SELECT id,batch,expiry,manufacturing_date FROM user_medicines WHERE product_id=? AND serial_number=?',
          productId,
          serial,
        )
      : null;
    if (bySerial) {
      if (
        (bySerial.batch && batch !== bySerial.batch) ||
        (bySerial.expiry && parsedExpiry.expiry !== bySerial.expiry) ||
        (bySerial.manufacturing_date &&
          bySerial.manufacturing_date !== final.fields.manufacturingDate.value)
      )
        throw new Error(
          'This serial is already recorded with different batch or expiry details. Review the package information.',
        );
      packageId = bySerial.id;
      await db.runAsync(
        "UPDATE user_medicines SET batch=CASE WHEN batch='' THEN ? ELSE batch END,expiry_precision=CASE WHEN expiry IS NULL AND ? IS NOT NULL THEN ? ELSE expiry_precision END,expiry_source=CASE WHEN expiry IS NULL AND ? IS NOT NULL THEN 'User-confirmed packaging scan' ELSE expiry_source END,expiry=COALESCE(expiry,?),manufacturing_date=COALESCE(manufacturing_date,?),verification_data=? WHERE id=?",
        batch,
        parsedExpiry.expiry,
        parsedExpiry.precision,
        parsedExpiry.expiry,
        parsedExpiry.expiry,
        final.fields.manufacturingDate.value,
        JSON.stringify(final.fields),
        packageId,
      );
    } else if (typeof options.duplicateChoice === 'number') {
      const existing = await db.getFirstAsync<{
        id: number;
        serial_number: string;
        batch: string;
        expiry: string | null;
      }>(
        'SELECT id,serial_number,batch,expiry FROM user_medicines WHERE id=? AND product_id=?',
        options.duplicateChoice,
        productId,
      );
      if (
        !existing ||
        (serial && existing.serial_number !== serial) ||
        existing.batch !== batch ||
        existing.expiry !== parsedExpiry.expiry
      )
        throw new Error('The selected existing pack does not match the reviewed package.');
      packageId = existing.id;
    } else {
      const possible =
        batch || parsedExpiry.expiry
          ? await db.getFirstAsync<{ id: number }>(
              'SELECT id FROM user_medicines WHERE product_id=? AND batch=? AND expiry IS ?',
              productId,
              batch,
              parsedExpiry.expiry,
            )
          : null;
      if (possible && options.duplicateChoice !== 'new')
        throw new Error(
          'A similar pack is already recorded. Choose the existing entry or explicitly add a separate pack.',
        );
      packageId = await saveInventory(db, {
        product_id: productId,
        quantity: options.quantity,
        unit: options.unit,
        batch,
        expiry: expiry ?? '',
        expiry_source: 'User-confirmed packaging scan',
        manufacturing_date: final.fields.manufacturingDate.value,
        serial_number: serial,
        verification_data: JSON.stringify(final.fields),
      });
    }
    await db.runAsync(
      "UPDATE scan_history SET verification_status='saved',status='Saved locally',reviewed_data=?,product_id=?,package_id=?,batch=?,expiry=?,serial=? WHERE id=?",
      JSON.stringify(final),
      productId,
      packageId,
      batch,
      expiry,
      serial,
      id,
    );
    await learnTemplate(db, id, final);
  });
  return packageId;
}
