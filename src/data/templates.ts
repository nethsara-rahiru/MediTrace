import type { SQLiteDatabase } from 'expo-sqlite';
import type { Extraction, FormatTemplate } from '../domain/extraction/types';
import { learnedRules, validateRules } from '../domain/extraction/templates';
export async function listTemplates(db: SQLiteDatabase): Promise<FormatTemplate[]> {
  const rows = await db.getAllAsync<{
    id: number;
    signature: string;
    rules_json: string;
    verification_status: 'candidate' | 'locally_confirmed';
    confirmations: number;
  }>('SELECT * FROM qr_format_templates ORDER BY id');
  return rows.flatMap((row) => {
    try {
      return [
        {
          id: row.id,
          signature: row.signature,
          rules: validateRules(JSON.parse(row.rules_json)),
          verification: row.verification_status,
          confirmations: row.confirmations,
        },
      ];
    } catch {
      return [];
    }
  });
}
// Called inside the same transaction that saves the reviewed scan.
export async function learnTemplate(db: SQLiteDatabase, scanId: number, reviewed: Extraction) {
  const rules = learnedRules(reviewed);
  if (!reviewed.signature || !rules.some((r) => r.field === 'productName')) return;
  const encoded = JSON.stringify(validateRules(rules));
  await db.runAsync(
    'INSERT OR IGNORE INTO qr_format_templates(signature,rules_json) VALUES (?,?)',
    reviewed.signature,
    encoded,
  );
  const template = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM qr_format_templates WHERE signature=? AND rules_json=?',
    reviewed.signature,
    encoded,
  );
  await db.runAsync(
    'INSERT OR IGNORE INTO template_observations(template_id,scan_id,payload) VALUES (?,?,?)',
    template!.id,
    scanId,
    reviewed.raw,
  );
  await db.runAsync(
    "UPDATE qr_format_templates SET confirmations=(SELECT COUNT(*) FROM template_observations WHERE template_id=?),verification_status=CASE WHEN (SELECT COUNT(*) FROM template_observations WHERE template_id=?)>=2 THEN 'locally_confirmed' ELSE 'candidate' END,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?",
    template!.id,
    template!.id,
    template!.id,
  );
}
