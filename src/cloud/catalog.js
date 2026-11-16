import { normalizeIdentifier } from '../domain/identifiers.js';
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
];
function object(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid shared catalog record.');
  return value;
}
export function parseCatalogRecord(value) {
  const row = object(value);
  if (
    typeof row.id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.id) ||
    typeof row.updated_at !== 'string' ||
    !Number.isFinite(Date.parse(row.updated_at)) ||
    !['approved', 'withdrawn', 'community'].includes(String(row.status))
  )
    throw new Error('Invalid shared catalog record.');
  if (row.status === 'withdrawn')
    return { id: row.id, updated_at: row.updated_at, status: 'withdrawn', product: null };
  const raw = object(row.product);
  const product = {};
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
    (row.status === 'approved' && raw.verification !== 'source_checked') ||
    (row.status === 'approved' &&
      (typeof raw.verified_at !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(raw.verified_at) ||
        new Date(raw.verified_at).toISOString().slice(0, 10) !== raw.verified_at))
  )
    throw new Error('Shared products need a name, source and valid review date.');
  product.verification = row.status === 'approved' ? 'source_checked' : 'user_entered';
  product.verified_at = row.status === 'approved' ? raw.verified_at : null;
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
  return {
    id: row.id,
    updated_at: row.updated_at,
    status: row.status,
    product,
  };
}
export async function fetchCatalog(config, request = fetch) {
  const records = [],
    seen = new Set();
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
      const rows = JSON.parse(body);
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
