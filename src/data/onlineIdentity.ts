import type { SQLiteDatabase } from 'expo-sqlite';
import { lookupProductByIdentifier } from '../cloud/lookup';
import type { CatalogConfig } from '../cloud/catalog';
import type { IdentityLookup } from '../domain/identityLookup';
import { normalizeIdentifier } from '../domain/identifiers';
import { bestIdentitySuggestion } from '../domain/extraction/suggestions';
import type { Session } from '../domain/extraction/types';
import { compatibleIdentity, identityKey } from '../domain/catalogCheck';
import { getSession, acceptIdentity } from './identification';
import { getProduct, findProduct, saveProduct } from './products';
import { snapshot } from './catalog';
export function needsOnlineIdentity(session: Session) {
  return (
    session.state === 'pending' &&
    !bestIdentitySuggestion(session.original) &&
    Boolean(session.original.fields.gtin.value)
  );
}
export async function findOnlineIdentity(
  session: Session,
  config: CatalogConfig,
  signal?: AbortSignal,
  request: typeof fetch = fetch,
): Promise<IdentityLookup> {
  if (!needsOnlineIdentity(session))
    throw new Error('Use the existing local identity confirmation.');
  const identifier = normalizeIdentifier(session.original.fields.gtin.value!);
  const base = { identifier, checkedAt: new Date().toISOString() };
  try {
    const records = await lookupProductByIdentifier(config, identifier, signal, request);
    // Validate the returned association even if the server or test gateway ignores its filter.
    const matches = records.filter((r) => r.product?.barcodes.includes(identifier));
    if (records.some((r) => r.status === 'withdrawn'))
      return {
        ...base,
        status: 'withdrawn',
        message:
          'The online record for this code was withdrawn. Enter the packaging identity manually.',
      };
    if (matches.length > 1 || records.length >= 21)
      return {
        ...base,
        status: 'ambiguous',
        message:
          'More than one online product uses this code. Check the packaging and enter the correct identity manually.',
      };
    if (matches.length === 1)
      return {
        ...base,
        status: 'matched',
        record: matches[0],
        message:
          'Identity found in the online database. Compare its name, strength and form with the packaging.',
      };
    return {
      ...base,
      status: 'not_found',
      message:
        'No online product matches this code. Enter the medicine name printed on the packaging.',
    };
  } catch {
    return {
      ...base,
      status: 'unavailable',
      message:
        'Online identity lookup is unavailable. Retry or enter the medicine name printed on the packaging.',
    };
  }
}
export async function storeOnlineIdentity(
  db: SQLiteDatabase,
  scanId: number,
  result: IdentityLookup,
) {
  const session = await getSession(db, scanId);
  if (
    !session ||
    !needsOnlineIdentity(session) ||
    normalizeIdentifier(session.original.fields.gtin.value!) !== result.identifier
  )
    return null;
  await db.runAsync(
    'INSERT INTO scan_identity_lookups(scan_id,result) VALUES (?,?) ON CONFLICT(scan_id) DO UPDATE SET result=excluded.result',
    scanId,
    JSON.stringify(result),
  );
  return getSession(db, scanId);
}
// Called only by the user's Yes action. Lookup itself neither imports products nor
// reveals clinical/package details. The original scan and extraction stay unchanged.
export async function confirmOnlineIdentity(
  db: SQLiteDatabase,
  scanId: number,
  remoteId: string,
  projectUrl: string,
): Promise<Session> {
  await db.withTransactionAsync(async () => {
    const session = await getSession(db, scanId),
      lookup = session?.onlineIdentity;
    const record = lookup?.record,
      input = record?.product;
    if (
      !session ||
      !needsOnlineIdentity(session) ||
      lookup?.status !== 'matched' ||
      !record ||
      record.id !== remoteId ||
      !input ||
      !input.barcodes.includes(normalizeIdentifier(session.original.fields.gtin.value!))
    )
      throw new Error(
        'The online suggestion is no longer available. Rescan or enter the identity manually.',
      );
    const link = await db.getFirstAsync<{ product_id: number }>(
      'SELECT product_id FROM cloud_catalog_links WHERE project_url=? AND remote_id=?',
      projectUrl,
      record.id,
    );
    let local = link ? await getProduct(db, link.product_id) : null;
    for (const code of input.barcodes) {
      const owner = await findProduct(db, code);
      if (owner && owner.id !== local?.id)
        throw new Error(
          'This barcode was added to a local product while checking online. Rescan to confirm that local record.',
        );
    }
    if (
      local &&
      (!local.barcodes.includes(lookup.identifier) ||
        !compatibleIdentity(
          {
            productId: local.id,
            name: input.name,
            strength: input.strength || null,
            dosageForm: input.dosage_form || null,
            override: false,
          },
          { ...record, product: local },
        ))
    )
      throw new Error('The cached local product changed. Rescan or identify the package manually.');
    const imported = !local;
    if (!local) {
      const id = await saveProduct(db, input, undefined, 'existing');
      local = (await getProduct(db, id))!;
      await db.runAsync(
        'INSERT INTO cloud_catalog_links(project_url,remote_id,product_id,snapshot,remote_updated_at) VALUES (?,?,?,?,?)',
        projectUrl,
        record.id,
        local.id,
        snapshot(local),
        record.updated_at,
      );
    }
    const confirmed = await acceptIdentity(db, scanId, { productId: local.id });
    if (imported)
      for (const field of Object.values(confirmed.reviewed!.fields))
        if (field.origin === 'catalog') field.retrieval = 'online';
    const check = {
      identityKey: identityKey(confirmed.identity!),
      checkedAt: lookup.checkedAt,
      status: 'matched',
      message:
        'System check: exact online barcode match. This is not medical or authenticity verification.',
      record,
      conflicts: [],
    };
    await db.runAsync(
      'UPDATE scan_history SET reviewed_data=? WHERE id=?',
      JSON.stringify(confirmed.reviewed),
      scanId,
    );
    await db.runAsync(
      'INSERT INTO scan_catalog_checks(scan_id,result) VALUES (?,?) ON CONFLICT(scan_id) DO UPDATE SET result=excluded.result',
      scanId,
      JSON.stringify(check),
    );
  });
  return (await getSession(db, scanId))!;
}
