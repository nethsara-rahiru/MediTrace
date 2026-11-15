import type { SQLiteDatabase } from 'expo-sqlite';
import { lookupConfirmedProduct } from '../cloud/lookup';
import type { CatalogConfig } from '../cloud/catalog';
import {
  compatibleIdentity,
  identityKey,
  enrichmentKeys,
  onlineConflicts,
  type OnlineCheck,
} from '../domain/catalogCheck';
import { catalogFields } from '../domain/extraction/engine';
import { copyExtraction } from '../domain/extraction/verification';
import { normalizeName } from '../domain/extraction/text';
import type { FieldKey, Session } from '../domain/extraction/types';
import { getSession } from './identification';
import { getProduct, saveProduct } from './products';
export function onlineFields(check: OnlineCheck) {
  return check.record?.product
    ? catalogFields(
        { ...check.record.product, id: 0, created_at: check.record.updated_at },
        'online',
      )
    : {};
}
export async function checkConfirmedMedicine(
  db: SQLiteDatabase,
  session: Session,
  config: CatalogConfig,
  signal?: AbortSignal,
  request: typeof fetch = fetch,
): Promise<OnlineCheck> {
  if (session.state !== 'identity_confirmed' || !session.identity || !session.reviewed)
    throw new Error('Confirm the medicine identity before checking online.');
  const base = {
    identityKey: identityKey(session.identity),
    checkedAt: new Date().toISOString(),
    conflicts: [],
  };
  try {
    const local = session.identity.productId
      ? await getProduct(db, session.identity.productId)
      : null;
    const link = local
      ? await db.getFirstAsync<{ remote_id: string }>(
          'SELECT remote_id FROM cloud_catalog_links WHERE project_url=? AND product_id=? UNION SELECT remote_id FROM product_publications WHERE project_url=? AND product_id=? LIMIT 1',
          config.url,
          local.id,
          config.url,
          local.id,
        )
      : null;
    const identifier = session.reviewed.fields.gtin.value;
    const records = await lookupConfirmedProduct(
      config,
      session.identity,
      identifier,
      link?.remote_id,
      signal,
      request,
    );
    if (records.some((r) => r.status === 'withdrawn'))
      return {
        ...base,
        status: 'withdrawn',
        message:
          'The online record was withdrawn. Check the packaging and consult a pharmacist before relying on this reference.',
      };
    const matches = records.filter(
      (record) =>
        compatibleIdentity(session.identity!, record) &&
        (!identifier || record.product!.barcodes.includes(identifier)) &&
        (!local?.pack_size ||
          normalizeName(local.pack_size) === normalizeName(record.product!.pack_size)),
    );
    if (records.length >= 21 || matches.length > 1)
      return {
        ...base,
        status: 'ambiguous',
        message:
          'More than one online package may match. Check the strength, form and pack variant; no online details were applied.',
      };
    if (!matches.length)
      return {
        ...base,
        status: records.length ? 'identity_conflict' : 'not_found',
        message: records.length
          ? 'Online identity or package information differs from the confirmed medicine. No online details were applied.'
          : 'No exact online match was found. Local and scanned information remain available.',
      };
    const record = matches[0];
    const conflicts = onlineConflicts(
      session.reviewed,
      onlineFields({ ...base, status: 'matched', message: '', record }),
    );
    return {
      ...base,
      status: conflicts.length ? 'conflict' : 'matched',
      record,
      conflicts,
      message: conflicts.length
        ? 'Local or scanned information differs from the online record. Review each difference.'
        : 'System check: exact online catalog match. This is a data match, not medical or authenticity verification.',
    };
  } catch {
    return {
      ...base,
      status: 'unavailable',
      message:
        'Online check unavailable. Local and scanned information remain available; you can retry.',
    };
  }
}
// Called inside the application's serialized mutation queue, only after the request
// finishes. No network request holds a SQLite transaction or blocks local display.
export async function applyOnlineCheck(
  db: SQLiteDatabase,
  scanId: number,
  result: OnlineCheck,
  projectUrl: string,
  protectedFields: readonly FieldKey[] = [],
): Promise<Session | null> {
  let saved: Session | null = null;
  await db.withTransactionAsync(async () => {
    const session = await getSession(db, scanId);
    if (
      !session?.identity ||
      !session.reviewed ||
      session.state !== 'identity_confirmed' ||
      identityKey(session.identity) !== result.identityKey
    )
      return;
    const check = { ...result };
    const reviewed = copyExtraction(session.reviewed);
    if (check.record?.product && ['matched', 'conflict'].includes(check.status)) {
      if (!compatibleIdentity(session.identity, check.record)) return;
      const fields = onlineFields(check);
      for (const key of enrichmentKeys)
        if (reviewed.fields[key].value === null && fields[key] && !protectedFields.includes(key))
          Object.assign(reviewed.fields, { [key]: fields[key] });
      check.conflicts = onlineConflicts(reviewed, fields);
      check.status = check.conflicts.length ? 'conflict' : 'matched';
      // Cache a new exact product for future offline scans. Existing local products
      // are preserved; the background check never overwrites their catalog entries.
      if (!session.identity.productId && check.record.product && check.status === 'matched') {
        const link = await db.getFirstAsync<{ product_id: number }>(
          'SELECT product_id FROM cloud_catalog_links WHERE project_url=? AND remote_id=?',
          projectUrl,
          check.record.id,
        );
        const existing = link ? await getProduct(db, link.product_id) : null;
        let ownerConflict = false;
        for (const identifier of check.record.product.barcodes) {
          const owner = await db.getFirstAsync<{ product_id: number }>(
            'SELECT product_id FROM barcodes WHERE identifier=?',
            identifier,
          );
          if (owner && owner.product_id !== existing?.id) ownerConflict = true;
        }
        if (!ownerConflict) {
          const productId =
            existing?.id ?? (await saveProduct(db, check.record.product, undefined, 'existing'));
          const product = (await getProduct(db, productId))!;
          if (compatibleIdentity(session.identity, { ...check.record, product })) {
            session.identity = { ...session.identity, productId };
            reviewed.predictedProductId = productId;
            // Preserve the original payload and identity confirmation; only bind the exact cache entry.
            if (!link) {
              const { id, created_at, ...rest } = product;
              const snapshot = JSON.stringify({
                ...rest,
                barcodes: [...rest.barcodes].sort(),
                ingredients: [...rest.ingredients].sort((a, b) => a.name.localeCompare(b.name)),
              });
              await db.runAsync(
                'INSERT INTO cloud_catalog_links(project_url,remote_id,product_id,snapshot,remote_updated_at) VALUES (?,?,?,?,?)',
                projectUrl,
                check.record.id,
                productId,
                snapshot,
                check.record.updated_at,
              );
            }
            check.identityKey = identityKey(session.identity);
          }
        }
      }
    }
    await db.runAsync(
      'UPDATE scan_history SET reviewed_data=?,identity_json=?,product_id=? WHERE id=?',
      JSON.stringify(reviewed),
      JSON.stringify(session.identity),
      session.identity.productId,
      scanId,
    );
    await db.runAsync(
      'INSERT INTO scan_catalog_checks(scan_id,result) VALUES (?,?) ON CONFLICT(scan_id) DO UPDATE SET result=excluded.result',
      scanId,
      JSON.stringify(check),
    );
    saved = await getSession(db, scanId);
  });
  return saved;
}
export async function chooseOnlineField(
  db: SQLiteDatabase,
  scanId: number,
  key: FieldKey,
  projectUrl: string,
) {
  if (!enrichmentKeys.includes(key as (typeof enrichmentKeys)[number]))
    throw new Error('Confirm identity changes separately.');
  const session = await getSession(db, scanId);
  const check = session?.onlineCheck;
  if (
    !session?.identity ||
    !session.reviewed ||
    session.state !== 'identity_confirmed' ||
    !check?.record ||
    check.identityKey !== identityKey(session.identity) ||
    !compatibleIdentity(session.identity, check.record)
  )
    throw new Error('Check the current medicine online before choosing a value.');
  const fields = onlineFields(check),
    field = fields[key];
  if (!field) throw new Error('No online value is available for this field.');
  const reviewed = copyExtraction(session.reviewed);
  Object.assign(reviewed.fields, { [key]: field });
  check.conflicts = onlineConflicts(reviewed, fields);
  check.status = check.conflicts.length ? 'conflict' : 'matched';
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE scan_history SET reviewed_data=? WHERE id=?',
      JSON.stringify(reviewed),
      scanId,
    );
    await db.runAsync(
      'UPDATE scan_catalog_checks SET result=? WHERE scan_id=?',
      JSON.stringify(check),
      scanId,
    );
  });
  return (await applyOnlineCheck(db, scanId, check, projectUrl)) ?? (await getSession(db, scanId))!;
}
