import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Bell, CalendarClock } from 'lucide-react-native';
import { router } from 'expo-router';
import { Page, Heading, Button, Card, Chips, Empty, Notice } from '../src/components/ui';
import { InventoryCard } from '../src/components/InventoryCard';
import { useData } from '../src/data/context';
import { expiryState } from '../src/domain/expiry';
import {
  remindersEnabled,
  setRemindersEnabled,
  reconcileReminders,
} from '../src/services/reminders';
import { colors } from '../src/theme';
export default function Expiry() {
  const { db, inventory } = useData();
  const [filter, setFilter] = useState('Expiring soon'),
    [enabled, setEnabled] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    void remindersEnabled(db)
      .then(setEnabled)
      .catch((e) => setError(e.message));
    void reconcileReminders(db).catch((e) => setError(e.message));
  }, [db]);
  const active = inventory.filter((i) => i.quantity > 0),
    rows = active.filter((i) => filter === 'All' || expiryState(i.expiry) === filter);
  async function toggle() {
    setBusy(true);
    setError('');
    try {
      await setRemindersEnabled(db, !enabled);
      setEnabled(await remindersEnabled(db));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page>
      <Heading
        title="Expiry tracker"
        subtitle="Keep an eye on what is coming up. Dates come from your recorded packaging information."
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        {(['Expired', 'Expiring soon', 'Expiry unknown'] as const).map((state) => (
          <Card key={state} style={{ flex: 1, minWidth: 140 }}>
            <Text
              style={{
                fontSize: 30,
                fontWeight: '700',
                color:
                  state === 'Expired'
                    ? colors.red
                    : state === 'Expiring soon'
                      ? colors.amber
                      : colors.navy,
              }}
            >
              {active.filter((i) => expiryState(i.expiry) === state).length}
            </Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>{state}</Text>
          </Card>
        ))}
      </View>
      <Card>
        <View style={{ flexDirection: 'row', gap: 13, alignItems: 'center' }}>
          <Bell color={colors.teal} size={22} />
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={{ fontSize: 15, color: colors.navy, fontWeight: '700' }}>
              A little heads-up
            </Text>
            <Text style={{ fontSize: 12, color: colors.muted, lineHeight: 20 }}>
              Opt in to local reminders around 30 days before expiry. Alerts use generic text to
              keep medicine names off your lock screen.
            </Text>
          </View>
        </View>
        <Button
          title={enabled ? 'Disable expiry reminders' : 'Enable expiry reminders'}
          variant="secondary"
          onPress={toggle}
          busy={busy}
        />
      </Card>
      {error && <Notice tone="amber">{error}</Notice>}
      <Chips
        items={['Expiring soon', 'Expired', 'Valid', 'Expiry unknown', 'All']}
        value={filter}
        onChange={setFilter}
      />
      {rows.map((i) => (
        <InventoryCard key={i.id} item={i} />
      ))}
      {!rows.length && (
        <Empty
          title={`No ${filter === 'All' ? 'recorded' : filter.toLowerCase()} medicines`}
          description="Only inventory entries with a quantity above zero appear in this tracker."
          action={
            <Button
              title="View my medicines"
              variant="secondary"
              onPress={() => router.push('/inventory')}
            />
          }
        />
      )}
      <Notice>
        “Valid” refers only to the recorded expiry date. It does not assess storage conditions,
        authenticity or suitability. Ask a pharmacist about expired medicine disposal and any
        after-opening limits.
      </Notice>
    </Page>
  );
}
