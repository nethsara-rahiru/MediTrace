import type { SQLiteDatabase } from 'expo-sqlite';
import type { Ingredient, InventoryItem } from '../domain/types';
import { parseExpiry } from '../domain/expiry';
import { readDate, chronologyError } from '../domain/extraction/dates';
export type InventoryInput = {
  product_id: number;
  quantity: number;
  unit: string;
  batch: string;
  expiry: string;
  expiry_source: string;
  manufacturing_date?: string | null;
  serial_number?: string;
  verification_data?: string;
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
  const current = id
    ? await db.getFirstAsync<{ manufacturing_date: string | null }>(
        'SELECT manufacturing_date FROM user_medicines WHERE id=?',
        id,
      )
    : null;
  const manufacturing =
    input.manufacturing_date === undefined
      ? (current?.manufacturing_date ?? null)
      : input.manufacturing_date?.trim() || null;
  const parsedManufacturing = manufacturing ? readDate(manufacturing) : null;
  if (parsedManufacturing?.issue) throw new Error(parsedManufacturing.issue);
  const dateError = chronologyError(parsedManufacturing?.value ?? null, input.expiry || null);
  if (dateError) throw new Error(dateError);
  if (input.serial_number && input.serial_number.length > 512)
    throw new Error('Serial number is too long.');

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
      'UPDATE user_medicines SET quantity=?,unit=?,batch=?,expiry=?,expiry_precision=?,expiry_source=?,manufacturing_date=?,serial_number=COALESCE(?,serial_number),verification_data=COALESCE(?,verification_data) WHERE id=?',
      ...values,
      parsedManufacturing?.value ?? null,
      input.serial_number ?? null,
      input.verification_data ?? null,
      id,
    );
    return id;
  }
  const result = await db.runAsync(
    'INSERT INTO user_medicines(quantity,unit,batch,expiry,expiry_precision,expiry_source,product_id,manufacturing_date,serial_number,verification_data) VALUES (?,?,?,?,?,?,?,?,?,?)',
    ...values,
    input.product_id,
    parsedManufacturing?.value ?? null,
    input.serial_number ?? '',
    input.verification_data ?? '{}',
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
