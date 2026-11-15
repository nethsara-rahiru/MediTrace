import type { SQLiteDatabase } from 'expo-sqlite';
import type { Product } from '../domain/types';
import { getProduct, saveProduct } from './products';
import { fetchCatalog, type CatalogConfig } from '../cloud/catalog';
// Snapshot the stored canonical values, including lowercased ingredient names.
export function snapshot(product: Product) {
  const { id, created_at, ...fields } = product;
  return JSON.stringify({
    ...fields,
    barcodes: [...fields.barcodes].sort(),
    ingredients: [...fields.ingredients].sort((a, b) => a.name.localeCompare(b.name)),
  });
}
export async function downloadCatalog(
  db: SQLiteDatabase,
  config: CatalogConfig,
  request: typeof fetch = fetch,
) {
  // Finish and validate every page before making any local changes.
  const records = await fetchCatalog(config, request);
  const counts = { added: 0, updated: 0, withdrawn: 0, conflicts: 0 };
  await db.withTransactionAsync(async () => {
    for (const row of records) {
      const owned = await db.getFirstAsync(
        'SELECT product_id FROM product_publications WHERE project_url=? AND remote_id=?',
        config.url,
        row.id,
      );
      if (owned && row.status === 'community') continue;
      const link = await db.getFirstAsync<{ product_id: number; snapshot: string }>(
        'SELECT product_id,snapshot FROM cloud_catalog_links WHERE project_url=? AND remote_id=?',
        config.url,
        row.id,
      );
      const current = link ? await getProduct(db, link.product_id) : null;
      if (link && (!current || snapshot(current) !== link.snapshot)) {
        counts.conflicts++;
        continue;
      }
      if (row.status === 'withdrawn') {
        if (link && current) {
          const notice = 'Withdrawn from shared catalog; recheck with a pharmacist.';
          const source = current.source.includes(notice)
            ? current.source
            : `${current.source}\n${notice}`;
          await saveProduct(
            db,
            { ...current, source, verification: 'user_entered', verified_at: null, barcodes: [] },
            current.id,
            'existing',
          );
          const stored = (await getProduct(db, current.id))!;
          await db.runAsync(
            'UPDATE cloud_catalog_links SET snapshot=?,remote_updated_at=? WHERE project_url=? AND remote_id=?',
            snapshot(stored),
            row.updated_at,
            config.url,
            row.id,
          );
          counts.withdrawn++;
        }
        continue;
      }
      const product = row.product!;
      let conflict = false;
      for (const identifier of product.barcodes) {
        const owner = await db.getFirstAsync<{ product_id: number }>(
          'SELECT product_id FROM barcodes WHERE identifier=?',
          identifier,
        );
        if (owner && owner.product_id !== link?.product_id) conflict = true;
      }
      if (conflict) {
        counts.conflicts++;
        continue;
      }
      const id = await saveProduct(db, product, link?.product_id, 'existing');
      const stored = (await getProduct(db, id))!;
      await db.runAsync(
        'INSERT INTO cloud_catalog_links(project_url,remote_id,product_id,snapshot,remote_updated_at) VALUES (?,?,?,?,?) ON CONFLICT(project_url,remote_id) DO UPDATE SET snapshot=excluded.snapshot,remote_updated_at=excluded.remote_updated_at',
        config.url,
        row.id,
        id,
        snapshot(stored),
        row.updated_at,
      );
      if (link) counts.updated++;
      else counts.added++;
    }
    await db.runAsync(
      'INSERT INTO preferences(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
      `catalog_last_download:${config.url}`,
      new Date().toISOString(),
    );
  });
  return counts;
}
