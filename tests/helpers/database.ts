import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { migrate } from '../../src/data/schema';
export async function database(filename = ':memory:', prepare?: (native: DatabaseSync) => void) {
  const native = new DatabaseSync(filename);
  const db = {
    execAsync: async (sql: string) => {
      native.exec(sql);
    },
    getFirstAsync: async (sql: string, ...args: any[]) => native.prepare(sql).get(...args) ?? null,
    getAllAsync: async (sql: string, ...args: any[]) => native.prepare(sql).all(...args),
    runAsync: async (sql: string, ...args: any[]) => {
      const r = native.prepare(sql).run(...args);
      return {
        lastInsertRowId: Number(r.lastInsertRowid),
        changes: Number(r.changes),
      };
    },
    withTransactionAsync: async (action: () => Promise<void>) => {
      native.exec('BEGIN');
      try {
        await action();
        native.exec('COMMIT');
      } catch (e) {
        native.exec('ROLLBACK');
        throw e;
      }
    },
  } as unknown as SQLiteDatabase;
  if (prepare) prepare(native);
  await migrate(db);
  return { db, native };
}
