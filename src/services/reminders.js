import { Platform } from 'react-native';
import { listInventory } from '../data/inventory.js';
import { localISO } from '../domain/expiry.js';
const preferenceKey = 'expiry_reminders_enabled';
export async function remindersEnabled(db) {
  return (
    (await db.getFirstAsync('SELECT value FROM preferences WHERE key=?', preferenceKey))?.value ===
    '1'
  );
}
async function notifications() {
  if (Platform.OS === 'web')
    throw new Error(
      'Local notifications are available in the Android or iOS app. The expiry tracker works here without them.',
    );
  const module = await import('expo-notifications');
  module.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  return module;
}
export async function setRemindersEnabled(db, enabled) {
  if (enabled) {
    const n = await notifications();
    if (Platform.OS === 'android')
      await n.setNotificationChannelAsync('expiry', {
        name: 'Medicine expiry reminders',
        importance: n.AndroidImportance.DEFAULT,
      });
    let permission = await n.getPermissionsAsync();
    if (!permission.granted) permission = await n.requestPermissionsAsync();
    if (!permission.granted)
      throw new Error(
        'Notification permission was not granted. You can still use the expiry tracker.',
      );
  }
  await db.runAsync(
    'INSERT INTO preferences(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
    preferenceKey,
    enabled ? '1' : '0',
  );
  await reconcileReminders(db);
}
let pending = Promise.resolve();
export function reconcileReminders(db) {
  const next = pending.then(() => reconcile(db));
  pending = next.catch(() => undefined);
  return next;
}
async function reconcile(db) {
  if (Platform.OS === 'web') return;
  const n = await notifications();
  const enabled = await remindersEnabled(db);
  const saved = await db.getAllAsync('SELECT * FROM expiry_reminders');
  const scheduled = new Set((await n.getAllScheduledNotificationsAsync()).map((x) => x.identifier));
  const items = enabled
    ? (await listInventory(db)).filter((i) => i.quantity > 0 && i.expiry && i.expiry >= localISO())
    : [];
  // Stay below conservative platform scheduling limits. Earliest expiry wins.
  const desired = new Map();
  for (const item of items.slice(0, 50)) {
    const [y, m, d] = item.expiry.split('-').map(Number);
    let trigger = new Date(y, m - 1, d - 30, 9);
    desired.set(item.id, trigger);
  }
  for (const row of saved) {
    if (
      desired.get(row.inventory_id)?.toISOString() === row.scheduled_for &&
      (scheduled.has(row.notification_id) || new Date(row.scheduled_for).getTime() <= Date.now())
    ) {
      desired.delete(row.inventory_id);
      continue;
    }
    await n.cancelScheduledNotificationAsync(row.notification_id);
    await db.runAsync('DELETE FROM expiry_reminders WHERE inventory_id=?', row.inventory_id);
  }
  for (const [id, date] of desired) {
    const actualDate = new Date(date);
    if (actualDate.getTime() <= Date.now()) {
      actualDate.setTime(Date.now());
      actualDate.setHours(9, 0, 0, 0);
      if (actualDate.getTime() <= Date.now()) actualDate.setDate(actualDate.getDate() + 1);
    }
    const notification_id = await n.scheduleNotificationAsync({
      content: {
        title: 'Medicine expiry reminder',
        body: 'A medicine in your inventory is approaching its recorded expiry. Open MedTrace to review your cabinet.',
        data: { inventoryId: id },
      },
      trigger: {
        type: n.SchedulableTriggerInputTypes.DATE,
        date: actualDate,
        channelId: 'expiry',
      },
    });
    await db.runAsync(
      'INSERT OR REPLACE INTO expiry_reminders(inventory_id,notification_id,scheduled_for) VALUES (?,?,?)',
      id,
      notification_id,
      date.toISOString(),
    );
  }
}
