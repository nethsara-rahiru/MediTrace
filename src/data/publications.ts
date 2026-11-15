import { publicationCredentials } from '../cloud/random';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { ProductInput } from '../domain/types';
import { parseCatalogRecord, type CatalogConfig } from '../cloud/catalog';
export type PublicationState = {
  project_url: string;
  product_id: number;
  pending: number;
  last_error: string;
  name: string;
};
// Accept only public product fields; never serialize an inventory row or scan session.
export function publicProduct(input: ProductInput): ProductInput {
  const text = (key: keyof ProductInput) =>
    typeof input[key] === 'string' ? (input[key] as string) : '';
  const candidate = {
    name: text('name'),
    generic_name: text('generic_name'),
    strength: text('strength'),
    dosage_form: text('dosage_form'),
    manufacturer: text('manufacturer'),
    manufacturer_address: text('manufacturer_address'),
    country: text('country'),
    category: text('category'),
    pack_size: text('pack_size'),
    storage: text('storage'),
    warnings: text('warnings'),
    indications: text('indications'),
    prescription: text('prescription'),
    source: text('source').replace(
      /User-reviewed packaging scan #\d+; not independently verified/g,
      'User-entered packaging information; not independently verified',
    ),
    ingredients: input.ingredients.filter((i) => i.name.trim()),
    barcodes: input.barcodes,
    verification: 'user_entered',
    verified_at: null,
  };
  return parseCatalogRecord({
    id: '00000000-0000-4000-8000-000000000000',
    status: 'community',
    updated_at: '2026-11-15T00:00:00Z',
    product: candidate,
  }).product!;
}
export async function queuePublication(
  db: SQLiteDatabase,
  projectUrl: string,
  productId: number,
  input: ProductInput,
) {
  const payload = JSON.stringify(publicProduct(input));
  if (payload.length > 20000)
    throw new Error('Product information is too large to share. Shorten the source text or notes.');
  const { remoteId, token } = await publicationCredentials();
  await db.runAsync(
    "INSERT INTO product_publications(project_url,product_id,remote_id,write_token,payload,pending,last_error) VALUES (?,?,?,?,?,1,'') ON CONFLICT(project_url,product_id) DO UPDATE SET payload=excluded.payload,pending=1,last_error=''",
    projectUrl,
    productId,
    remoteId,
    token,
    payload,
  );
}
export async function listPublicationStates(db: SQLiteDatabase): Promise<PublicationState[]> {
  return db.getAllAsync<PublicationState>(
    'SELECT u.project_url,u.product_id,u.pending,u.last_error,p.name FROM product_publications u JOIN products p ON p.id=u.product_id ORDER BY p.name',
  );
}
export async function flushPublications(
  db: SQLiteDatabase,
  config: CatalogConfig,
  request: typeof fetch = fetch,
) {
  const rows = await db.getAllAsync<{
    product_id: number;
    remote_id: string;
    write_token: string;
    payload: string;
  }>(
    "SELECT product_id,remote_id,write_token,payload FROM product_publications WHERE project_url=? AND pending=1 ORDER BY (last_error<>''),product_id LIMIT 20",
    config.url,
  );
  let uploaded = 0;
  for (const row of rows) {
    let continueQueue = false;
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await request(`${config.url}/rest/v1/rpc/publish_catalog_product`, {
        method: 'POST',
        headers: { apikey: config.key, 'Content-Type': 'application/json' },
        redirect: 'error',
        signal: controller.signal,
        body: JSON.stringify({
          p_id: row.remote_id,
          p_write_token: row.write_token,
          p_product: JSON.parse(row.payload),
        }),
      });
      if (!response.ok) {
        continueQueue =
          response.status === 400 || response.status === 409 || response.status === 422;
        let detail = '';
        try {
          const error = await response.json();
          if (typeof error.message === 'string') detail = error.message;
        } catch {
          /* Use the HTTP error below. */
        }
        if (response.status === 404)
          throw new Error('Online saving needs setup. Run migration 002 in Supabase, then retry.');
        if (/barcode.*already/i.test(detail))
          throw new Error(
            'This barcode already belongs to another shared product. Correct the local product identifiers before retrying.',
          );
        if (/cannot edit|cannot be changed/i.test(detail))
          throw new Error(
            'This shared record cannot be edited from this device. Your local changes are retained.',
          );
        throw new Error(
          `Online save unavailable (${response.status}). Your product is saved locally.`,
        );
      }
      const saved: unknown = await response.json();
      if (saved !== row.remote_id)
        throw new Error('Online save was not acknowledged. The product remains queued.');
      await db.withTransactionAsync(async () => {
        // A pending product may have been edited while its upload was in flight.
        await db.runAsync(
          "UPDATE product_publications SET pending=0,last_error='' WHERE project_url=? AND product_id=? AND payload=?",
          config.url,
          row.product_id,
          row.payload,
        );
      });
      uploaded++;
    } catch (e) {
      const message = controller.signal.aborted
        ? 'Online save timed out. Saved locally and queued for retry.'
        : e instanceof Error
          ? e.message
          : 'Online save failed. Saved locally and queued for retry.';
      await db.runAsync(
        'UPDATE product_publications SET last_error=? WHERE project_url=? AND product_id=?',
        message,
        config.url,
        row.product_id,
      );
      // Avoid hammering an unavailable service; later saves and retries resume the queue.
      if (!continueQueue) break;
    } finally {
      clearTimeout(timer);
    }
  }
  return uploaded;
}
