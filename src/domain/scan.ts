import { normalizeIdentifier } from './identifiers';
import { parseDigitalLink, parseGS1, type GS1Result } from './gs1';
export type DecodedScan = GS1Result & { raw: string; format: string; identifier: string | null; kind: 'product' | 'gs1' | 'url' | 'unknown' };
export function decodeScan(raw: string, format: string): DecodedScan {
 const value = raw.trim();
 const base: DecodedScan = { raw: value, format, identifier: null, kind: 'unknown', notes: [] };
 if (!value || value.length > 4096) return { ...base, notes: ['Empty or oversized scan content.'] };
 const link = parseDigitalLink(value);
 if (link) return { ...base, ...link, kind: 'gs1', identifier: link.gtin ?? null };
 if (/^https?:\/\//i.test(value)) return { ...base, kind: 'url', notes: ['This QR code contains a website address. It was not opened or used as a product identifier.'] };
 if (/^\](d2|C1|Q3)/.test(value) || value.startsWith('(01)') || (['datamatrix','code128'].includes(format) && value.includes('\x1d') && value.startsWith('01'))) {
   const parsed = parseGS1(value);
   return { ...base, ...parsed, kind: 'gs1', identifier: parsed.gtin ?? null };
 }
 // DataMatrix payloads without a GS1 indicator or separator are not guessed to be GS1.
 try { return { ...base, kind: 'product', identifier: normalizeIdentifier(value,format) }; }
 catch (error) { return { ...base, notes: [(error as Error).message] }; }
}
