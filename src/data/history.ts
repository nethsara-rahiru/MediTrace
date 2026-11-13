import type { SQLiteDatabase } from 'expo-sqlite';
import type { DecodedScan } from '../domain/scan';
import type { Scan } from '../domain/types';
export async function recordScan(db: SQLiteDatabase, scan: DecodedScan, productId: number | null) {
 const status=productId ? 'Catalog match' : scan.kind === 'url' ? 'Website QR' : scan.notes.length ? 'Needs review' : 'Unknown product';
 const r=await db.runAsync('INSERT INTO scan_history(raw,format,identifier,product_id,status,batch,expiry,serial,notes) VALUES (?,?,?,?,?,?,?,?,?)',scan.raw,scan.format,scan.identifier,productId,status,scan.batch ?? null,scan.expiry ?? null,scan.serial ?? null,scan.notes.join('\n'));
 return r.lastInsertRowId;
}
export async function listHistory(db: SQLiteDatabase, search = '') {
 const q=search.trim().toLowerCase();
 return db.getAllAsync<Scan>(`SELECT h.*,p.name FROM scan_history h LEFT JOIN products p ON p.id=h.product_id WHERE ?='' OR instr(lower(COALESCE(p.name,'')||' '||COALESCE(h.identifier,'')||' '||h.status||' '||h.raw),?)>0 ORDER BY h.id DESC LIMIT 200`,q,q);
}
