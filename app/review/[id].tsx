import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Page,
  Back,
  Heading,
  Card,
  Badge,
  Button,
  Notice,
  Field,
  Section,
} from '../../src/components/ui';
import { ReviewField } from '../../src/components/ReviewField';
import { useIdentification } from '../../src/hooks/useIdentification';
import { useData } from '../../src/data/context';
import {
  getSession,
  persistReview,
  rejectIdentity,
  saveIdentification,
} from '../../src/data/identification';
import { editField, verifyField } from '../../src/domain/extraction/verification';
import { packageKeys, type FieldKey, type Token } from '../../src/domain/extraction/types';
import { parseExpiry, expiryState } from '../../src/domain/expiry';
import { chronologyError } from '../../src/domain/extraction/dates';
import { colors } from '../../src/theme';
import { reconcileReminders } from '../../src/services/reminders';
function Check({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={onChange}
      style={{
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
        paddingVertical: 10,
        minHeight: 48,
      }}
    >
      <View
        style={{
          width: 23,
          height: 23,
          borderRadius: 6,
          borderWidth: 2,
          borderColor: colors.teal,
          backgroundColor: value ? colors.teal : colors.white,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {value && <Text style={{ color: 'white', fontWeight: '700' }}>✓</Text>}
      </View>
      <Text style={{ flex: 1, color: colors.text, fontSize: 13, lineHeight: 21 }}>{label}</Text>
    </Pressable>
  );
}
export default function ReviewMedicine() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, mutate, session, setSession, loading, error, setError, reload } = useIdentification(
    Number(id),
  );
  const { inventory } = useData();
  const [checked, setChecked] = useState(false),
    [conflict, setConflict] = useState(false),
    [busy, setBusy] = useState(false),
    [quantity, setQuantity] = useState('1'),
    [unit, setUnit] = useState('units'),
    [duplicate, setDuplicate] = useState<number | 'new' | undefined>(),
    [dirty, setDirty] = useState<Set<FieldKey>>(new Set()),
    [showRaw, setShowRaw] = useState(false);
  if (loading)
    return (
      <Page>
        <ActivityIndicator color={colors.teal} />
      </Page>
    );
  if (!session)
    return (
      <Page>
        <Back />
        <Notice tone="red">{error || 'Scan session unavailable.'}</Notice>
      </Page>
    );
  if (
    !session.identity ||
    !session.reviewed ||
    !['identity_confirmed', 'saved'].includes(session.state)
  )
    return (
      <Page>
        <Heading
          title="Confirm medicine identity first"
          subtitle="Package details remain hidden until you confirm the medicine name and strength."
        />
        <Button
          title="Confirm medicine identity"
          onPress={() => router.replace(`/identify/${session.id}`)}
        />
      </Page>
    );
  const reviewed = session.reviewed,
    identity = session.identity,
    saved = session.state === 'saved';
  const expiry = reviewed.fields.expiryDate.value,
    parsedExpiry = expiry ? parseExpiry(expiry) : null;
  const verifiedExpiry =
    expiry &&
    (checked ||
      ['user_confirmed', 'source_checked'].includes(reviewed.fields.expiryDate.verification));
  const state = verifiedExpiry ? expiryState(parsedExpiry?.expiry ?? null) : 'Expiry unknown';
  const chronology = chronologyError(reviewed.fields.manufacturingDate.value, expiry);
  const serial = reviewed.fields.serialNumber.value ?? '',
    batch = reviewed.fields.batchNumber.value ?? '';
  const bySerial = serial
    ? inventory.find((i) => i.product_id === identity.productId && i.serial_number === serial)
    : undefined;
  const serialConflict = Boolean(
    bySerial &&
    ((bySerial.batch && bySerial.batch !== batch) ||
      (bySerial.expiry && bySerial.expiry !== (parsedExpiry?.expiry ?? null)) ||
      (bySerial.manufacturing_date &&
        bySerial.manufacturing_date !== reviewed.fields.manufacturingDate.value)),
  );
  const similar =
    !bySerial && Boolean(batch || expiry)
      ? inventory.filter(
          (i) =>
            i.product_id === identity.productId &&
            i.batch === batch &&
            i.expiry === (parsedExpiry?.expiry ?? null),
        )
      : [];
  async function apply(key: FieldKey, text?: string, token?: Token) {
    setChecked(false);
    setDuplicate(undefined);
    const next = await mutate(async () => {
      const fresh = await getSession(db, session!.id);
      if (!fresh?.reviewed) throw new Error('Scan review is unavailable.');
      const updated =
        text === undefined
          ? verifyField(fresh.reviewed, key)
          : editField(fresh.reviewed, key, text, token);
      return persistReview(db, session!.id, updated);
    });
    setSession({ ...session!, reviewed: next });
  }
  async function useRecordedPack() {
    if (!bySerial) return;
    setBusy(true);
    setChecked(false);
    setError('');
    try {
      const next = await mutate(async () => {
        const current = await getSession(db, session!.id);
        if (!current?.reviewed) throw new Error('Scan review is unavailable.');
        let changed = editField(current.reviewed, 'batchNumber', bySerial.batch);
        changed = editField(
          changed,
          'expiryDate',
          bySerial.expiry_precision === 'month'
            ? (bySerial.expiry ?? '').slice(0, 7)
            : (bySerial.expiry ?? ''),
        );
        changed = editField(changed, 'manufacturingDate', bySerial.manufacturing_date ?? '');
        await persistReview(db, session!.id, changed);
        return changed;
      });
      setSession({ ...session!, reviewed: next });
      setDirty(
        (previous) =>
          new Set(
            [...previous].filter(
              (key) => !['batchNumber', 'manufacturingDate', 'expiryDate'].includes(key),
            ),
          ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function changeIdentity() {
    setBusy(true);
    try {
      await mutate(() => rejectIdentity(db, session!.id));
      router.replace(`/identify/${session!.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    setError('');
    try {
      if (dirty.size) throw new Error('Apply or clear your field edits before saving.');
      if (!quantity.trim()) throw new Error('Enter the pack quantity.');
      await mutate(() =>
        saveIdentification(db, session!.id, reviewed, {
          packageChecked: checked,
          conflictChecked: conflict,
          quantity: Number(quantity),
          unit,
          duplicateChoice: duplicate,
        }),
      );
      await reconcileReminders(db).catch(() => undefined);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function field(key: FieldKey) {
    const value = reviewed.fields[key];
    return (
      <ReviewField
        key={`${key}:${JSON.stringify(value)}`}
        fieldKey={key}
        field={value}
        tokens={reviewed.tokens}
        readOnly={saved}
        onApply={(text, token) => apply(key, text, token)}
        onVerify={() => apply(key)}
        onDirty={(value) =>
          setDirty((prev) => {
            const next = new Set(prev);
            if (value) next.add(key);
            else next.delete(key);
            return next;
          })
        }
      />
    );
  }
  return (
    <Page>
      <Back label="Scan history" />
      <Heading
        title={saved ? 'Saved medicine identification' : 'Review medicine details'}
        subtitle={
          saved
            ? 'Your original scan, corrections and verification evidence are stored locally.'
            : 'Check each available field against the package. Confirming the name did not verify these details.'
        }
      />
      {Boolean(error) && <Notice tone="red">{error}</Notice>}
      <Card>
        <Badge label={saved ? 'Saved locally' : 'Identity user-confirmed'} tone="green" />
        <Text style={{ fontSize: 25, fontWeight: '700', color: colors.navy }}>
          {identity.name}
          {identity.strength ? ` ${identity.strength}` : ''}
        </Text>
        {Boolean(identity.dosageForm) && (
          <Text style={{ color: colors.muted }}>{identity.dosageForm}</Text>
        )}
        {!saved && (
          <Button
            title="Change medicine identity"
            variant="secondary"
            onPress={() => void changeIdentity()}
            disabled={busy}
          />
        )}
      </Card>
      {saved ? (
        <Notice>
          Saved successfully. User confirmation records what you checked; it does not independently
          establish medical accuracy, authenticity or personal suitability.
        </Notice>
      ) : (
        <Notice>
          Edits are saved with this scan. Existing library records are not overwritten. Missing
          information may stay blank.
        </Notice>
      )}
      <Section title="Product information" />
      {field('activeIngredients')}
      {field('manufacturer')}
      {field('manufacturerAddress')}
      <Section title="Package information" />
      {packageKeys.map(field)}
      {Boolean(verifiedExpiry) && (
        <Badge
          label={state === 'Expired' ? 'Expired · confirmed recorded date' : state}
          tone={state === 'Expired' ? 'red' : state === 'Expiring soon' ? 'amber' : 'green'}
        />
      )}
      {Boolean(chronology) && <Notice tone="red">{chronology}</Notice>}
      {reviewed.issues.length > 0 && (
        <Card>
          <Text style={{ fontSize: 16, color: colors.navy, fontWeight: '700' }}>
            Notes from the original scan
          </Text>
          {reviewed.issues.map((issue, i) => (
            <Text key={i} style={{ color: colors.muted, fontSize: 12, lineHeight: 21 }}>
              {issue}
            </Text>
          ))}
        </Card>
      )}
      <Card>
        <Button
          title={showRaw ? 'Hide original scan' : 'Show original scan'}
          variant="secondary"
          onPress={() => setShowRaw((v) => !v)}
        />
        {showRaw && (
          <>
            <Text selectable style={{ color: colors.text, fontSize: 12, lineHeight: 21 }}>
              {session.raw}
            </Text>
            {session.original.additionalInformation.map((item, index) => (
              <View key={index} style={{ gap: 4 }}>
                <Text style={{ color: colors.muted, fontSize: 11 }}>{item.label}</Text>
                <Text selectable style={{ color: colors.text, fontSize: 12, lineHeight: 20 }}>
                  {item.value}
                </Text>
              </View>
            ))}
            <Notice>
              Original content is retained as evidence. It may include a rejected prediction and is
              never executed or opened.
            </Notice>
          </>
        )}
      </Card>
      {!saved ? (
        <>
          <Section title="Save this pack" />
          {bySerial &&
            (serialConflict ? (
              <Card>
                <Notice tone="amber">
                  This serial is already recorded, but the package fields disagree. Compare the
                  physical pack with the recorded entry before saving.
                </Notice>
                <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 22 }}>
                  Recorded batch: {bySerial.batch || 'Unknown'}
                  {'\n'}Recorded expiry:{' '}
                  {bySerial.expiry_precision === 'month'
                    ? bySerial.expiry?.slice(0, 7)
                    : (bySerial.expiry ?? 'Unknown')}
                </Text>
                <Button
                  title="Use existing package details"
                  variant="secondary"
                  onPress={() => void useRecordedPack()}
                  busy={busy}
                />
                <Button
                  title="Manage recorded medicine"
                  variant="secondary"
                  onPress={() =>
                    router.push({ pathname: '/inventory-entry', params: { id: bySerial.id } })
                  }
                />
              </Card>
            ) : (
              <Notice>
                This serial is already recorded. Saving will link this scan to the existing entry
                without increasing its quantity.
              </Notice>
            ))}
          {similar.length > 0 && (
            <Card>
              <Text style={{ color: colors.navy, fontWeight: '700', fontSize: 16 }}>
                This pack may already be in your cabinet
              </Text>
              <Text style={{ color: colors.muted, lineHeight: 21, fontSize: 13 }}>
                The batch and expiry match an existing entry. Choose how to record this scan.
              </Text>
              {similar.map((item) => (
                <Button
                  key={item.id}
                  title={`${duplicate === item.id ? 'Selected: ' : ''}Use existing entry #${item.id}`}
                  variant="secondary"
                  onPress={() => setDuplicate(item.id)}
                />
              ))}
              <Button
                title={
                  duplicate === 'new' ? 'Selected: add a separate pack' : 'Add a separate pack'
                }
                variant="secondary"
                onPress={() => setDuplicate('new')}
              />
            </Card>
          )}
          {!bySerial && typeof duplicate !== 'number' && (
            <Card>
              <Field
                label="Pack quantity"
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="decimal-pad"
              />
              <Field label="Quantity unit" value={unit} onChangeText={setUnit} />
            </Card>
          )}
          <Card>
            <Check
              label="I checked the package details against the physical packaging."
              value={checked}
              onChange={() => setChecked((v) => !v)}
            />
            {(reviewed.identityConflict || identity.override) && (
              <Check
                label="I checked the conflicting identity against the package."
                value={conflict}
                onChange={() => setConflict((v) => !v)}
              />
            )}
            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 20 }}>
              This confirms available package fields only. Product ingredients and manufacturer
              details retain their own verification indicators.
            </Text>
          </Card>
          {dirty.size > 0 && (
            <Notice tone="amber">Apply your field corrections before saving.</Notice>
          )}
          <Button
            title="Save checked package locally"
            busy={busy}
            disabled={
              !checked ||
              dirty.size > 0 ||
              Boolean(chronology) ||
              serialConflict ||
              Boolean(similar.length && !duplicate) ||
              Boolean((reviewed.identityConflict || identity.override) && !conflict)
            }
            onPress={() => void save()}
          />
        </>
      ) : (
        <>
          {session.packageId ? (
            <Button
              title="View saved medicine"
              onPress={() =>
                router.push({ pathname: '/inventory-entry', params: { id: session.packageId! } })
              }
            />
          ) : (
            <Notice>
              The inventory entry was removed. This scan and its verification evidence are still
              available in history.
            </Notice>
          )}
          <Button
            title="Scan another package"
            variant="secondary"
            onPress={() => router.replace('/scanner')}
          />
        </>
      )}
      {!saved && (
        <Button
          title="Scan another package"
          variant="secondary"
          onPress={() => router.replace('/scanner')}
        />
      )}
      <Notice>
        MedTrace does not diagnose, prescribe or recommend doses. A code and a user confirmation do
        not prove medicine authenticity. Consult a qualified pharmacist when information is
        uncertain.
      </Notice>
    </Page>
  );
}
