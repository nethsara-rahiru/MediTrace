import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Badge, Button, Card, Field, Notice } from './ui';
import { colors } from '../theme';
import type { ExtractedField, FieldKey, Token } from '../domain/extraction/types';
import type { DetectedIngredient as Ingredient } from '../domain/extraction/types';
export const fieldLabels: Record<FieldKey, string> = {
  productName: 'Medicine name',
  strength: 'Medicine strength',
  dosageForm: 'Dosage form',
  activeIngredients: 'Active ingredients',
  manufacturer: 'Manufacturer',
  manufacturerAddress: 'Manufacturer address',
  batchNumber: 'Batch / lot number',
  manufacturingDate: 'Manufacturing date',
  expiryDate: 'Expiry date',
  gtin: 'Barcode / GTIN',
  serialNumber: 'Serial number',
};
const methodLabels: Record<string, string> = {
  database: 'Local catalog',
  history: 'Previously confirmed scan',
  gs1: 'Standard packaging code',
  labelled: 'Labelled scan data',
  pattern: 'Pattern suggestion',
  fuzzy: 'Similar local name',
  template: 'Local format mapping',
  user: 'User correction',
  ai: 'AI suggestion',
  none: 'No value detected',
};
export function fieldText(value: string | Ingredient[] | null) {
  return Array.isArray(value)
    ? value.map((i) => [i.name, i.strength].filter(Boolean).join(' ')).join('\n')
    : (value ?? '');
}
export function ReviewField({
  fieldKey,
  field,
  tokens,
  readOnly,
  onApply,
  onVerify,
  onDirty,
}: {
  fieldKey: FieldKey;
  field: ExtractedField<string | Ingredient[]>;
  tokens: Token[];
  readOnly: boolean;
  onApply: (text: string, token?: Token) => Promise<void>;
  onVerify: () => Promise<void>;
  onDirty: (dirty: boolean) => void;
}) {
  const initial = fieldText(field.value);
  const [text, setText] = useState(initial),
    [showSource, setShowSource] = useState(false),
    [pickSource, setPickSource] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const dirty = text !== initial;
  const label = fieldLabels[fieldKey],
    status =
      field.value === null
        ? 'Missing information'
        : field.verification === 'user_confirmed'
          ? 'User-confirmed'
          : field.verification === 'source_checked'
            ? 'Source-checked catalog'
            : field.method === 'labelled'
              ? 'Extracted from label'
              : field.method === 'database'
                ? 'User-entered catalog'
                : 'Uncertain · check packaging';
  async function act(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
      onDirty(false);
      setPickSource(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <View style={{ gap: 10 }}>
        <Text style={{ fontSize: 15, color: colors.navy, fontWeight: '700' }}>{label}</Text>
        <Badge
          label={status}
          tone={
            field.verification === 'user_confirmed' || field.verification === 'source_checked'
              ? 'green'
              : field.value === null
                ? 'neutral'
                : 'amber'
          }
        />
      </View>
      {readOnly ? (
        <Text selectable style={{ color: colors.text, lineHeight: 23 }}>
          {initial || 'Not recorded'}
        </Text>
      ) : (
        <>
          <Field
            label={label}
            value={text}
            onChangeText={(v) => {
              setText(v);
              onDirty(v !== initial);
            }}
            multiline={fieldKey === 'activeIngredients' || fieldKey === 'manufacturerAddress'}
            maxLength={fieldKey === 'activeIngredients' ? 2048 : 512}
            placeholder={
              fieldKey === 'manufacturingDate' || fieldKey === 'expiryDate'
                ? 'YYYY-MM or YYYY-MM-DD'
                : 'Not detected — enter only if known'
            }
            hint={
              fieldKey === 'activeIngredients'
                ? 'One ingredient per line. Include its amount and unit when printed.'
                : fieldKey === 'manufacturingDate' || fieldKey === 'expiryDate'
                  ? 'Keep month-only precision when the label gives only a month and year.'
                  : undefined
            }
          />
          <Button
            title={
              dirty ? `Apply ${label.toLowerCase()} correction` : `Confirm ${label.toLowerCase()}`
            }
            variant="secondary"
            busy={busy}
            disabled={!dirty && field.value === null}
            onPress={() => void act(dirty ? () => onApply(text) : onVerify)}
          />
          {tokens.length > 0 && (
            <Button
              title={
                pickSource
                  ? 'Hide scanned values'
                  : `Choose scanned value for ${label.toLowerCase()}`
              }
              variant="secondary"
              onPress={() => setPickSource((v) => !v)}
            />
          )}
        </>
      )}
      {pickSource &&
        !readOnly &&
        tokens.map((token, index) => (
          <Pressable
            accessibilityRole="button"
            key={`${token.locator}:${index}`}
            onPress={() => void act(() => onApply(token.raw, token))}
            style={{
              padding: 12,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 10,
              gap: 5,
            }}
          >
            <Text style={{ fontSize: 11, color: colors.muted }}>{token.label}</Text>
            <Text style={{ fontSize: 13, color: colors.text }}>{token.raw.slice(0, 180)}</Text>
          </Pressable>
        ))}
      {Boolean(error) && <Notice tone="red">{error}</Notice>}
      <Button
        title={showSource ? 'Hide field evidence' : `Show evidence for ${label.toLowerCase()}`}
        variant="secondary"
        onPress={() => setShowSource((v) => !v)}
      />
      {showSource && (
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 12, color: colors.muted, lineHeight: 20 }}>
            Method: {methodLabels[field.method] ?? field.method}
            {'\n'}Source: {field.source ?? 'Not available'}
            {'\n'}Parser confidence: {field.confidence}. This is not a guarantee of accuracy.
          </Text>
          <Text selectable style={{ fontSize: 12, color: colors.text, lineHeight: 20 }}>
            Original evidence:{' '}
            {field.originalValue ?? 'No literal scanned value; see the cited local source.'}
          </Text>
        </View>
      )}
    </Card>
  );
}
