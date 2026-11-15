import { parseCatalogRecord, type CatalogConfig, type CatalogRecord } from './catalog';
import type { Identity } from '../domain/extraction/types';
import { normalizeIdentifier } from '../domain/identifiers';
export async function lookupConfirmedProduct(
  config: CatalogConfig,
  identity: Identity,
  identifier: string | null,
  remoteId?: string,
  signal?: AbortSignal,
  request: typeof fetch = fetch,
): Promise<CatalogRecord[]> {
  const load = async (filter: string) => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort);
    if (signal?.aborted) controller.abort();
    const timer = setTimeout(abort, 10000);
    try {
      const response = await request(
        `${config.url}/rest/v1/catalog_products?select=id,product,status,updated_at&limit=21&${filter}`,
        {
          headers: { apikey: config.key, Accept: 'application/json' },
          signal: controller.signal,
          redirect: 'error',
        },
      );
      if (!response.ok)
        throw new Error(
          'Online catalog is unavailable. Local and scanned information remain available.',
        );
      const text = await response.text();
      if (text.length > 1_500_000) throw new Error('Online response is too large.');
      const rows: unknown = JSON.parse(text);
      if (!Array.isArray(rows) || rows.length > 21)
        throw new Error('Invalid online catalog response.');
      return rows.map(parseCatalogRecord);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  };
  if (remoteId && /^[a-f0-9-]{36}$/i.test(remoteId)) {
    const records = await load(`id=eq.${remoteId}`);
    if (records.length) return records;
  }
  if (identifier && identifier.length <= 256 && !/^https?:/i.test(identifier)) {
    const records = await load(
      `product->barcodes=cs.${encodeURIComponent(JSON.stringify([normalizeIdentifier(identifier)]))}`,
    );
    if (records.length) return records;
  }
  // Exact case-insensitive name filter, with wildcard metacharacters escaped.
  const name = identity.name.replace(/[\\%_*]/g, (character) => `\\${character}`);
  return load(`status=in.(approved,community)&product->>name=ilike.${encodeURIComponent(name)}`);
}
