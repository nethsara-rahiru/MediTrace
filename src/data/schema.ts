import type { SQLiteDatabase } from "expo-sqlite";
export const SCHEMA_VERSION = 2;
export const schema = `
CREATE TABLE data_sources (
 id INTEGER PRIMARY KEY, description TEXT NOT NULL UNIQUE
);
CREATE TABLE products (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL CHECK(length(trim(name))>0),
 generic_name TEXT NOT NULL DEFAULT '', strength TEXT NOT NULL DEFAULT '', dosage_form TEXT NOT NULL DEFAULT '',
 manufacturer TEXT NOT NULL DEFAULT '', country TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT 'Uncategorised',
 pack_size TEXT NOT NULL DEFAULT '', storage TEXT NOT NULL DEFAULT '', warnings TEXT NOT NULL DEFAULT '',
 indications TEXT NOT NULL DEFAULT '', prescription TEXT NOT NULL DEFAULT '',
 source_id INTEGER REFERENCES data_sources(id), verified_at TEXT,
 verification TEXT NOT NULL DEFAULT 'user_entered' CHECK(verification IN ('user_entered','source_checked')),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE barcodes (
 identifier TEXT PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE
);
CREATE INDEX barcodes_product ON barcodes(product_id);
CREATE TABLE ingredients (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE);
CREATE TABLE product_ingredients (
 product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
 ingredient_id INTEGER NOT NULL REFERENCES ingredients(id), strength TEXT NOT NULL DEFAULT '',
 PRIMARY KEY(product_id,ingredient_id)
);
CREATE INDEX products_name ON products(name COLLATE NOCASE);
CREATE INDEX products_category ON products(category);
CREATE TABLE user_medicines (
 id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
 quantity REAL NOT NULL CHECK(quantity>=0), unit TEXT NOT NULL DEFAULT 'units', batch TEXT NOT NULL DEFAULT '',
 expiry TEXT, expiry_precision TEXT NOT NULL DEFAULT 'unknown' CHECK(expiry_precision IN ('day','month','unknown')),
 expiry_source TEXT NOT NULL DEFAULT 'User-entered',
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 CHECK((expiry IS NULL AND expiry_precision='unknown') OR (expiry IS NOT NULL AND expiry_precision IN ('day','month')))
);
CREATE INDEX inventory_expiry ON user_medicines(expiry);
CREATE INDEX inventory_product ON user_medicines(product_id);
CREATE TABLE scan_history (
 id INTEGER PRIMARY KEY, raw TEXT NOT NULL, format TEXT NOT NULL, identifier TEXT,
 product_id INTEGER REFERENCES products(id) ON DELETE SET NULL, status TEXT NOT NULL,
 batch TEXT, expiry TEXT, serial TEXT, notes TEXT NOT NULL DEFAULT '',
 scanned_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX history_date ON scan_history(scanned_at DESC);
CREATE TABLE expiry_reminders (
 inventory_id INTEGER PRIMARY KEY REFERENCES user_medicines(id) ON DELETE CASCADE,
 notification_id TEXT NOT NULL, scheduled_for TEXT NOT NULL
);
PRAGMA user_version = 1;
`;
export async function migrate(db: SQLiteDatabase) {
  await db.execAsync("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
  const version = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  if ((version?.user_version ?? 0) > SCHEMA_VERSION)
    throw new Error("This database needs a newer version of MedTrace.");
  if ((version?.user_version ?? 0) === 0)
    await db.withTransactionAsync(async () => {
      await db.execAsync(schema);
    });
  if ((version?.user_version ?? 0) < 2)
    await db.withTransactionAsync(async () => {
      await db.execAsync(
        "CREATE TABLE IF NOT EXISTS preferences (key TEXT PRIMARY KEY,value TEXT NOT NULL); PRAGMA user_version = 2;",
      );
    });
}
