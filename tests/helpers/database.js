import { DatabaseSync } from 'node:sqlite';
import { migrate } from '../../src/data/schema.js';
export async function database(filename = ':memory:', prepare) {
  const native = new DatabaseSync(filename);
  const db = {
    execAsync: async (sql) => {
      native.exec(sql);
    },
    getFirstAsync: async (sql, ...args) => native.prepare(sql).get(...args) ?? null,
    getAllAsync: async (sql, ...args) => native.prepare(sql).all(...args),
    runAsync: async (sql, ...args) => {
      const r = native.prepare(sql).run(...args);
      return {
        lastInsertRowId: Number(r.lastInsertRowid),
        changes: Number(r.changes),
      };
    },
    withTransactionAsync: async (action) => {
      native.exec('BEGIN');
      try {
        await action();
        native.exec('COMMIT');
      } catch (e) {
        native.exec('ROLLBACK');
        throw e;
      }
    },
  };
  if (prepare) prepare(native);
  await migrate(db);
  return { db, native };
}
