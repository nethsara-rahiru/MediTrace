import type { ProductInput } from '../domain/types';
import { normalizeIdentifier } from '../domain/identifiers';
export type CatalogConfig = { url: string; key: string };
export type CatalogRecord = {
  id: string;
  updated_at: string;
  status: 'approved' | 'withdrawn';
  product: ProductInput | null;
};
const textKeys = [
  'name',
  'generic_name',
  'strength',
  'dosage_form',
  'manufacturer',
  'manufacturer_address',
  'country',
  'category',
  'pack_size',
  'storage',
  'warnings',
  'indications',
  'prescription',
  'source',
] as const;
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid shared catalog record.');
  return value as Record<string, unknown>;
}
export function parseCatalogRecord(value: unknown): CatalogRecord {
  const row = object(value);
  if (
    typeof row.id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.id) ||
    typeof row.updated_at !== 'string' ||
    !Number.isFinite(Date.parse(row.updated_at)) ||
    !['approved', 'withdrawn'].includes(String(row.status))
  )
    throw new Error('Invalid shared catalog record.');
  if (row.status === 'withdrawn')
    return { id: row.id, updated_at: row.updated_at, status: 'withdrawn', product: null };
  const raw = object(row.product);
  const product = {} as ProductInput;
  for (const key of textKeys) {
    const value = raw[key] ?? '';
    if (
      typeof value !== 'string' ||
      value.length > (key === 'name' ? 160 : 4096) ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
    )
      throw new Error('Invalid text in shared catalog.');
    product[key] = value.trim();
  }
  if (
    !product.name ||
    !product.source ||
    raw.verification !== 'source_checked' ||
    typeof raw.verified_at !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(raw.verified_at) ||
    new Date(raw.verified_at).toISOString().slice(0, 10) !== raw.verified_at
  )
    throw new Error('Shared products need a name, source and valid review date.');
  product.verification = 'source_checked';
  product.verified_at = raw.verified_at;
  if (
    !Array.isArray(raw.ingredients) ||
    raw.ingredients.length > 50 ||
    !Array.isArray(raw.barcodes) ||
    raw.barcodes.length > 50
  )
    throw new Error('Invalid ingredient or barcode list.');
  product.ingredients = raw.ingredients.map((value) => {
    const item = object(value);
    if (
      typeof item.name !== 'string' ||
      !item.name.trim() ||
      item.name.length > 160 ||
      typeof item.strength !== 'string' ||
      item.strength.length > 160
    )
      throw new Error('Invalid shared ingredient.');
    return { name: item.name.trim(), strength: item.strength.trim() };
  });
  product.barcodes = [
    ...new Set(
      raw.barcodes.map((value) => {
        if (
          typeof value !== 'string' ||
          !value.trim() ||
          value.length > 256 ||
          /[\s\u0000-\u001f]/.test(value) ||
          /^https?:/i.test(value)
        )
          throw new Error('Invalid shared barcode.');
        return normalizeIdentifier(value);
      }),
    ),
  ];
  return { id: row.id, updated_at: row.updated_at, status: 'approved', product };
}
export async function fetchCatalog(
  config: CatalogConfig,
  request: typeof fetch = fetch,
): Promise<CatalogRecord[]> {
  const records: CatalogRecord[] = [],
    seen = new Set<string>();
  let after = '';
  for (let page = 0; page < 100; page++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await request(
        `${config.url}/rest/v1/catalog_products?select=id,product,status,updated_at&order=id.asc&limit=200${after ? `&id=gt.${after}` : ''}`,
        {
          headers: { apikey: config.key, Accept: 'application/json' },
          signal: controller.signal,
          redirect: 'error',
        },
      );
      if (!response.ok)
        throw new Error(
          response.status === 404
            ? 'The shared catalog needs setup. Run the supplied SQL in your Supabase dashboard.'
            : `Shared catalog unavailable (${response.status}). Try again later.`,
        );
      const body = await response.text();
      if (body.length > 4_000_000) throw new Error('Shared catalog response is too large.');
      const rows: unknown = JSON.parse(body);
      if (!Array.isArray(rows) || rows.length > 200)
        throw new Error('Invalid shared catalog response.');
      const parsed = rows.map(parseCatalogRecord);
      for (const row of parsed) {
        if (seen.has(row.id) || (after && row.id <= after))
          throw new Error('Invalid shared catalog pagination.');
        seen.add(row.id);
        records.push(row);
      }
      if (parsed.length < 200) return records;
      after = parsed[parsed.length - 1].id;
    } catch (error) {
      if (controller.signal.aborted)
        throw new Error('Connection timed out. Your offline library is unchanged.');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error('Shared catalog exceeds this app version’s download limit.');
}
