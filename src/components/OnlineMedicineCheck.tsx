import { Text, View, ActivityIndicator } from 'react-native';
import { Badge, Button, Card, Notice } from './ui';
import { fieldText, fieldLabels } from './ReviewField';
import { identityKey } from '../domain/catalogCheck';
import { onlineFields } from '../data/onlineIdentification';
import type { Session, FieldKey } from '../domain/extraction/types';
import { colors } from '../theme';
export function OnlineMedicineCheck({
  session,
  error,
  checking,
  retry,
  onChoose,
  disabled,
}: {
  session: Session;
  error?: string;
  checking: boolean;
  retry: () => void;
  onChoose: (key: FieldKey) => void;
  disabled: boolean;
}) {
  const stored = session.onlineCheck;
  const check =
    stored && session.identity && stored.identityKey === identityKey(session.identity)
      ? stored
      : null;
  const fields = check ? onlineFields(check) : {};
  return (
    <Card>
      <Text style={{ color: colors.navy, fontWeight: '700', fontSize: 17 }}>
        Data sources & online check
      </Text>
      <Text style={{ color: colors.muted, lineHeight: 22 }}>
        Local and scanned information appears immediately. The background check sends only the
        confirmed product name or product identifier, not your package or inventory records.
      </Text>
      {Boolean(error) && <Notice tone="amber">{error}</Notice>}
      {checking && (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <ActivityIndicator color={colors.teal} />
          <Text style={{ color: colors.muted }}>Checking online in the background…</Text>
        </View>
      )}
      {check && (
        <>
          <Badge
            label={
              check.status === 'matched'
                ? 'System checked · online catalog match'
                : check.status === 'conflict'
                  ? 'Online differences found'
                  : check.status === 'unavailable'
                    ? 'Online unavailable'
                    : check.status === 'not_found'
                      ? 'No online match'
                      : check.status === 'withdrawn'
                        ? 'Online record withdrawn'
                        : 'Online identity needs review'
            }
            tone={check.status === 'matched' ? 'neutral' : 'amber'}
          />
          <Notice
            tone={
              ['conflict', 'identity_conflict', 'withdrawn', 'ambiguous'].includes(check.status)
                ? 'amber'
                : 'neutral'
            }
          >
            {check.status === 'matched'
              ? 'The exact online catalog identity matches. A catalog match does not verify medical accuracy or authenticity.'
              : check.message}
          </Notice>
          {check.record?.product && (
            <Text style={{ color: colors.muted, lineHeight: 21 }}>
              Online source: {check.record.product.source}
              {'\n'}Status:{' '}
              {check.record.product.verification === 'source_checked'
                ? 'Source checked'
                : 'User-entered — not independently verified'}
              {check.record.product.verified_at
                ? ` · Reviewed ${check.record.product.verified_at}`
                : ''}
            </Text>
          )}
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Last online check: {new Date(check.checkedAt).toLocaleString()}
          </Text>
          {check.conflicts.map((key) => (
            <View key={key} style={{ gap: 9 }}>
              <Text style={{ color: colors.navy, fontWeight: '700' }}>{fieldLabels[key]}</Text>
              <Text selectable style={{ color: colors.text }}>
                Current: {fieldText(session.reviewed!.fields[key].value)}
                {'\n'}Online: {fieldText(fields[key]?.value ?? null)}
              </Text>
              {session.state === 'identity_confirmed' && (
                <Button
                  title={`Use online ${fieldLabels[key].toLowerCase()}`}
                  variant="secondary"
                  disabled={disabled}
                  onPress={() => onChoose(key)}
                />
              )}
            </View>
          ))}
        </>
      )}
      {!checking && !check && (
        <Text style={{ color: colors.muted }}>
          Online check starts after medicine identity confirmation.
        </Text>
      )}
      {session.state === 'identity_confirmed' && (
        <Button
          title="Retry online check"
          variant="secondary"
          disabled={checking || disabled}
          onPress={retry}
        />
      )}
    </Card>
  );
}
