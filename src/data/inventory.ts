import type { SQLiteDatabase } from 'expo-sqlite';
import type { Ingredient, InventoryItem } from '../domain/types';
import { parseExpiry } from '../domain/expiry';
export type InventoryInput = {
  product_id: number;
  quantity: number;
  unit: string;
  batch: string;
  expiry: string;
  expiry_source: string;
};
export async function listInventory(db: SQLiteDatabase): Promise<InventoryItem[]> {
  const rows = await db.getAllAsync<InventoryItem>(
    `SELECT u.*,p.name,p.strength,p.dosage_form,p.generic_name FROM user_medicines u JOIN products p ON p.id=u.product_id ORDER BY u.expiry IS NULL,u.expiry,u.created_at DESC`,
  );
  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      ingredients: await db.getAllAsync<Ingredient>(
        'SELECT i.name, pi.strength FROM product_ingredients pi JOIN ingredients i ON i.id=pi.ingredient_id WHERE pi.product_id=?',
        row.product_id,
      ),
    })),
  );
}
export async function saveInventory(db: SQLiteDatabase, input: InventoryInput, id?: number) {
  if (!Number.isFinite(input.quantity) || input.quantity < 0)
    throw new Error('Quantity must be a number of zero or more.');
  if (!input.unit.trim()) throw new Error('Enter the quantity unit, such as tablets or bottles.');
  const { expiry, precision } = parseExpiry(input.expiry);
  const values = [
    input.quantity,
    input.unit.trim(),
    input.batch.trim(),
    expiry,
    precision,
    input.expiry_source,
  ];
  if (id) {
    await db.runAsync(
      'UPDATE user_medicines SET quantity=?,unit=?,batch=?,expiry=?,expiry_precision=?,expiry_source=? WHERE id=?',
      ...values,
      id,
    );
    return id;
  }
  const result = await db.runAsync(
    'INSERT INTO user_medicines(quantity,unit,batch,expiry,expiry_precision,expiry_source,product_id) VALUES (?,?,?,?,?,?,?)',
    ...values,
    input.product_id,
  );
  return result.lastInsertRowId;
}
export async function removeInventory(db: SQLiteDatabase, id: number) {
  const reminder = await db.getFirstAsync<{ notification_id: string }>(
    'SELECT notification_id FROM expiry_reminders WHERE inventory_id=?',
    id,
  );
  if (reminder) {
    const { Platform } = await import('react-native');
    if (Platform.OS !== 'web') {
      const n = await import('expo-notifications');
      await n.cancelScheduledNotificationAsync(reminder.notification_id);
    }
  }
  await db.runAsync('DELETE FROM user_medicines WHERE id=?', id);
}
