import { parseCatalogRecord, type CatalogConfig, type CatalogRecord } from './catalog';
import type { Identity } from '../domain/extraction/types';
import { normalizeIdentifier, validGTIN } from '../domain/identifiers';
export async function lookupConfirmedProduct(
  config: CatalogConfig,
  identity: Identity | null,
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
    const variants = identifierVariants(identifier);
    const filter =
      variants.length === 1
        ? `product->barcodes=cs.${encodeURIComponent(JSON.stringify(variants))}`
        : `or=${encodeURIComponent(`(${variants.map((value) => `product->barcodes.cs.${JSON.stringify([value])}`).join(',')})`)}`;
    const records = await load(filter);
    if (records.length) return records;
  }
  if (!identity) return [];
  // Exact case-insensitive name filter, with wildcard metacharacters escaped.
  const name = identity.name.replace(/[\\%_*]/g, (character) => `\\${character}`);
  return load(`status=in.(approved,community)&product->>name=ilike.${encodeURIComponent(name)}`);
}

// Legacy administrator-entered JSON may contain an EAN/UPC without GTIN-14 padding.
// Only equivalent check-digit-valid numeric representations are considered.
export function identifierVariants(identifier: string) {
  const normalized = normalizeIdentifier(identifier);
  const values = new Set([normalized, identifier.trim()]);
  if (validGTIN(normalized))
    for (const length of [8, 12, 13]) {
      const value = normalized.slice(-length);
      if (validGTIN(value) && value.padStart(14, '0') === normalized) values.add(value);
    }
  return [...values];
}
export function lookupProductByIdentifier(
  config: CatalogConfig,
  identifier: string,
  signal?: AbortSignal,
  request: typeof fetch = fetch,
) {
  if (!identifier.trim() || identifier.length > 256 || /^https?:/i.test(identifier))
    throw new Error('A product identifier is required.');
  return lookupConfirmedProduct(config, null, identifier, undefined, signal, request);
}
