import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Pill, ScanLine } from 'lucide-react-native';
import {
  Page,
  Back,
  Heading,
  Card,
  Badge,
  Button,
  Field,
  Notice,
} from '../../src/components/ui.js';
import { useOnlineIdentity } from '../../src/hooks/useOnlineIdentity.js';
import { confirmOnlineIdentity } from '../../src/data/onlineIdentity.js';
import { catalogConfig } from '../../src/cloud/config.js';
import { useIdentification } from '../../src/hooks/useIdentification.js';
import { useData } from '../../src/data/context.js';
import { acceptIdentity, rejectIdentity } from '../../src/data/identification.js';
import {
  bestIdentitySuggestion,
  otherIdentitySuggestions,
} from '../../src/domain/extraction/suggestions.js';
import { colors } from '../../src/theme.js';
export default function ConfirmMedicine() {
  const { id } = useLocalSearchParams();
  const { db, mutate, session, setSession, loading, error, setError } = useIdentification(
    Number(id),
  );
  const { products } = useData();
  const [selected, setSelected] = useState(null),
    [correcting, setCorrecting] = useState(false),
    [rejectedKeys, setRejectedKeys] = useState([]),
    [manual, setManual] = useState(false),
    [query, setQuery] = useState(''),
    [name, setName] = useState(''),
    [strength, setStrength] = useState(''),
    [form, setForm] = useState(''),
    [busy, setBusy] = useState(false);
  const onlineIdentity = useOnlineIdentity(session, setSession);
  if (loading)
    return (
      <Page>
        <ActivityIndicator color={colors.teal} />
        <Heading title="Preparing identity check" />
      </Page>
    );
  if (!session)
    return (
      <Page>
        <Back />
        <Notice tone="red">{error || 'Scan session unavailable.'}</Notice>
        <Button title="Scan again" onPress={() => router.replace('/scanner')} />
      </Page>
    );
  if (session.state === 'saved' || session.state === 'identity_confirmed')
    return (
      <Page>
        <Heading
          title="Medicine identity confirmed"
          subtitle="Continue to the field review for this saved scan session."
        />
        <Button
          title="Continue to medicine details"
          onPress={() => router.replace(`/review/${session.id}`)}
        />
        {session.state !== 'saved' && (
          <Button
            title="Change medicine identity"
            variant="secondary"
            onPress={() => void reject()}
          />
        )}
      </Page>
    );
  const original = session.original;
  const defaultCandidate = bestIdentitySuggestion(original) ?? onlineIdentity.suggestion;
  const chosen = selected ?? (session.state === 'rejected' ? null : defaultCandidate);
  const predictedName = chosen?.name ?? null;
  const predictedStrength = chosen?.strength ?? null;
  const predictedForm = chosen?.dosageForm ?? null;
  const showCorrection =
    manual || (!selected && (correcting || session.state === 'rejected' || !predictedName));
  async function reject() {
    setBusy(true);
    setError('');
    try {
      const rejected =
        selected ?? bestIdentitySuggestion(session.original) ?? onlineIdentity.suggestion;
      await mutate(() => rejectIdentity(db, session.id));
      if (rejected) setRejectedKeys((keys) => [...new Set([...keys, rejected.key])]);
      setSession({
        ...session,
        state: 'rejected',
        reviewed: null,
        identity: null,
        rejectionCount: session.rejectionCount + 1,
      });
      setSelected(null);
      setCorrecting(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    setBusy(true);
    setError('');
    try {
      const next = await mutate(() =>
        !manual && chosen?.key.startsWith('online:')
          ? confirmOnlineIdentity(db, session.id, chosen.key.slice(7), catalogConfig().url)
          : acceptIdentity(
              db,
              session.id,
              manual
                ? { name, strength, dosageForm: form }
                : {
                    productId: chosen?.productId,
                    name: predictedName ?? '',
                    strength: predictedStrength ?? '',
                    dosageForm: predictedForm ?? '',
                  },
            ),
      );
      setSession(next);
      router.replace(`/review/${session.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function pick(candidate) {
    setSelected(candidate);
    setCorrecting(false);
    setManual(false);
    setName('');
  }
  const excluded = rejectedKeys.length
    ? rejectedKeys
    : session.state === 'rejected' && defaultCandidate
      ? [defaultCandidate.key]
      : [];
  const possible = otherIdentitySuggestions(original, excluded);
  const search = query.trim().toLowerCase();
  return (
    <Page>
      <Back label="Scanner" />
      <Heading
        title="Is this your medicine?"
        subtitle="Is this the largest medicine name printed on the box? Check its spelling and strength against the packaging."
      />
      {Boolean(error) && <Notice tone="red">{error}</Notice>}
      {onlineIdentity.checking && (
        <Card>
          <ActivityIndicator color={colors.teal} />
          <Text style={{ color: colors.muted }}>
            No local match. Looking up the barcode online…
          </Text>
        </Card>
      )}
      {Boolean(onlineIdentity.error) && <Notice tone="amber">{onlineIdentity.error}</Notice>}
      {onlineIdentity.lookup && onlineIdentity.lookup.status !== 'matched' && (
        <Notice>{onlineIdentity.lookup.message}</Notice>
      )}
      {!onlineIdentity.checking && onlineIdentity.lookup && session.state === 'pending' && (
        <Button
          title="Retry online barcode lookup"
          variant="secondary"
          onPress={onlineIdentity.retry}
          disabled={busy}
        />
      )}

      {predictedName && !manual ? (
        <Card style={{ alignItems: 'center', paddingVertical: 32 }}>
          <View style={{ padding: 17, backgroundColor: colors.mint, borderRadius: 19 }}>
            <Pill size={30} color={colors.teal} />
          </View>
          <Badge label="Please confirm identity" tone="amber" />
          {chosen?.key.startsWith('online:') && (
            <Badge label="Identity source: Online database" tone="neutral" />
          )}
          <Text style={{ fontSize: 14, color: colors.muted }}>Medicine detected</Text>
          <Text
            accessibilityRole="header"
            style={{ fontSize: 27, fontWeight: '700', color: colors.navy, textAlign: 'center' }}
          >
            {predictedName}
            {predictedStrength ? ` ${predictedStrength}` : ''}
          </Text>
          {Boolean(chosen?.packSize) && (
            <Text style={{ color: colors.muted, fontSize: 13 }}>Pack: {chosen?.packSize}</Text>
          )}
          {Boolean(predictedForm) && (
            <Text style={{ color: colors.muted, fontSize: 15 }}>{predictedForm}</Text>
          )}
        </Card>
      ) : (
        <Notice>
          {onlineIdentity.checking
            ? 'This barcode does not contain a medicine name. Checking the online catalog; manual entry is also available.'
            : session.state === 'rejected'
              ? 'Choose another suggestion, search the library or enter the medicine name printed on the box.'
              : 'We could not identify this medicine automatically. Please enter the medicine name printed on the packaging.'}
        </Notice>
      )}
      {original.identityConflict && (
        <Notice tone="amber">
          The code and identity text disagree. Check the name and strength carefully before
          continuing.
        </Notice>
      )}
      {showCorrection ? (
        <Card>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.navy }}>
            Find the correct identity
          </Text>
          {possible.map((c) => (
            <Pressable
              key={c.key}
              accessibilityRole="button"
              onPress={() => pick(c)}
              style={{
                padding: 14,
                borderWidth: 1,
                borderColor: selected?.key === c.key ? colors.teal : colors.border,
                borderRadius: 12,
                gap: 5,
              }}
            >
              <Text style={{ color: colors.navy, fontWeight: '600' }}>
                {[c.name, c.strength, c.dosageForm, c.packSize].filter(Boolean).join(' · ')}
              </Text>
              <Text style={{ fontSize: 11, color: colors.muted }}>
                {c.productId ? 'Local product suggestion' : 'Possible text identity'}
              </Text>
            </Pressable>
          ))}
          <Field
            label="Search local medicines"
            placeholder="Brand, generic name or ingredient"
            value={query}
            onChangeText={setQuery}
          />
          {Boolean(search) &&
            products
              .filter((p) =>
                [p.name, p.generic_name, ...p.ingredients.map((i) => i.name)]
                  .join(' ')
                  .toLowerCase()
                  .includes(search),
              )
              .slice(0, 12)
              .map((p) => (
                <Button
                  key={p.id}
                  title={[p.name, p.strength, p.dosage_form, p.pack_size]
                    .filter(Boolean)
                    .join(' · ')}
                  variant="secondary"
                  onPress={() =>
                    pick({
                      key: `product:${p.id}`,
                      productId: p.id,
                      name: p.name,
                      strength: p.strength || null,
                      dosageForm: p.dosage_form || null,
                      packSize: p.pack_size || null,
                      score: 1,
                      reason: 'Selected by user',
                    })
                  }
                />
              ))}
          <Button
            title={manual ? 'Use a local suggestion instead' : 'Enter medicine identity manually'}
            variant="secondary"
            onPress={() => setManual((v) => !v)}
          />
          {manual && (
            <>
              <Field
                label="Medicine name"
                placeholder="Name printed on the packaging"
                value={name}
                onChangeText={setName}
                maxLength={160}
              />
              <Field
                label="Medicine strength"
                placeholder="Leave blank if not printed or unknown"
                value={strength}
                onChangeText={setStrength}
                maxLength={80}
              />
              <Field
                label="Dosage form"
                placeholder="Leave blank if unknown"
                value={form}
                onChangeText={setForm}
                maxLength={80}
              />
            </>
          )}
        </Card>
      ) : null}
      {(manual || predictedName) && (
        <Button
          title={manual ? 'Confirm entered medicine' : 'Yes, correct medicine'}
          onPress={() => void confirm()}
          busy={busy}
          disabled={manual ? !name.trim() : false}
        />
      )}
      {predictedName && !manual && (
        <Button
          title="No, incorrect medicine"
          variant="secondary"
          onPress={() => void reject()}
          disabled={busy}
        />
      )}
      <Button
        title="Scan again"
        variant="secondary"
        icon={<ScanLine size={17} color={colors.teal} />}
        onPress={() => router.replace('/scanner')}
      />
      <Notice>
        Confirming the identity does not verify the remaining information or prove authenticity.
        Package fields will be checked separately.
      </Notice>
    </Page>
  );
}
