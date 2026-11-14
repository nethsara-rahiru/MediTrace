import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Pill, ScanLine } from 'lucide-react-native';
import { Page, Back, Heading, Card, Badge, Button, Field, Notice } from '../../src/components/ui';
import { useIdentification } from '../../src/hooks/useIdentification';
import { useData } from '../../src/data/context';
import { acceptIdentity, rejectIdentity } from '../../src/data/identification';
import type { Candidate } from '../../src/domain/extraction/types';
import { colors } from '../../src/theme';
export default function ConfirmMedicine() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, mutate, session, setSession, loading, error, setError } = useIdentification(
    Number(id),
  );
  const { products } = useData();
  const [selected, setSelected] = useState<Candidate | null>(null),
    [correcting, setCorrecting] = useState(false),
    [manual, setManual] = useState(false),
    [query, setQuery] = useState(''),
    [name, setName] = useState(''),
    [strength, setStrength] = useState(''),
    [form, setForm] = useState(''),
    [busy, setBusy] = useState(false);
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
          onPress={() => router.replace(`/review/${session!.id}`)}
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
  const defaultCandidate = original.candidates.find(
    (c) => c.productId === original.predictedProductId && c.productId !== null,
  );
  const chosen = selected ?? (session.state === 'rejected' ? null : defaultCandidate) ?? null;
  const predictedName =
    chosen?.name ?? (session.state === 'rejected' ? null : original.fields.productName.value);
  const predictedStrength =
    chosen?.strength ?? (session.state === 'rejected' ? null : original.fields.strength.value);
  const predictedForm =
    chosen?.dosageForm ?? (session.state === 'rejected' ? null : original.fields.dosageForm.value);
  const showCorrection = correcting || session.state === 'rejected' || !predictedName;
  const ambiguous =
    original.predictedProductId === null &&
    original.candidates.filter((c) => c.productId !== null && c.score >= 0.8).length > 1 &&
    !selected;
  async function reject() {
    setBusy(true);
    setError('');
    try {
      await mutate(() => rejectIdentity(db, session!.id));
      setSession({
        ...session!,
        state: 'rejected',
        reviewed: null,
        identity: null,
        rejectionCount: session!.rejectionCount + 1,
      });
      setSelected(null);
      setCorrecting(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    setBusy(true);
    setError('');
    try {
      const next = await mutate(() =>
        acceptIdentity(
          db,
          session!.id,
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
      router.replace(`/review/${session!.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function pick(candidate: Candidate) {
    setSelected(candidate);
    setManual(false);
    setName('');
  }
  const possible = original.candidates.filter(
    (c) =>
      session.state !== 'rejected' ||
      original.predictedProductId === null ||
      c.productId !== original.predictedProductId,
  );
  const search = query.trim().toLowerCase();
  return (
    <Page>
      <Back label="Scanner" />
      <Heading
        title="Is this your medicine?"
        subtitle="Please compare the detected medicine name and strength with the information printed on the medicine packaging."
      />
      {Boolean(error) && <Notice tone="red">{error}</Notice>}
      {predictedName && !manual ? (
        <Card style={{ alignItems: 'center', paddingVertical: 32 }}>
          <View style={{ padding: 17, backgroundColor: colors.mint, borderRadius: 19 }}>
            <Pill size={30} color={colors.teal} />
          </View>
          <Badge label="Please confirm identity" tone="amber" />
          <Text style={{ fontSize: 14, color: colors.muted }}>Medicine detected</Text>
          <Text
            accessibilityRole="header"
            style={{ fontSize: 27, fontWeight: '700', color: colors.navy, textAlign: 'center' }}
          >
            {predictedName}
            {predictedStrength ? ` ${predictedStrength}` : ''}
          </Text>
          {Boolean(predictedForm) && (
            <Text style={{ color: colors.muted, fontSize: 15 }}>{predictedForm}</Text>
          )}
        </Card>
      ) : (
        <Notice>
          We could not identify this medicine automatically. Please enter the medicine name printed
          on the packaging.
        </Notice>
      )}
      {original.identityConflict && (
        <Notice tone="amber">
          The code and identity text disagree. Check the name and strength carefully before
          continuing.
        </Notice>
      )}
      {ambiguous && (
        <Notice tone="amber">
          Several local products may match. Select the exact name and strength below before
          confirming.
        </Notice>
      )}
      {showCorrection || ambiguous ? (
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
                {[c.name, c.strength, c.dosageForm].filter(Boolean).join(' · ')}
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
                  title={[p.name, p.strength, p.dosage_form].filter(Boolean).join(' · ')}
                  variant="secondary"
                  onPress={() =>
                    pick({
                      key: `product:${p.id}`,
                      productId: p.id,
                      name: p.name,
                      strength: p.strength || null,
                      dosageForm: p.dosage_form || null,
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
          disabled={manual ? !name.trim() : ambiguous}
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
