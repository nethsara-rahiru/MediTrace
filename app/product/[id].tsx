import { useLocalSearchParams, router } from 'expo-router';
import { Text, View } from 'react-native';
import { Pencil, Plus } from 'lucide-react-native';
import { useData } from '../../src/data/context';
import {
  Page,
  Back,
  Heading,
  Card,
  Badge,
  Button,
  Notice,
  Section,
  Empty,
} from '../../src/components/ui';
import { colors } from '../../src/theme';
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 5, flex: 1, minWidth: 180 }}>
      <Text style={{ fontSize: 11, color: colors.muted }}>{label}</Text>
      <Text style={{ fontSize: 14, color: colors.text, lineHeight: 22 }}>
        {value || 'Not recorded'}
      </Text>
    </View>
  );
}
export default function ProductDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { products } = useData();
  const p = products.find((p) => p.id === Number(id));
  if (!p)
    return (
      <Page>
        <Back />
        <Empty
          title="Product unavailable"
          description="This product is not in the local catalog."
        />
      </Page>
    );
  return (
    <Page>
      <Back label="Medicine library" />
      <Heading
        title={p.name}
        subtitle={[p.generic_name, p.strength, p.dosage_form].filter(Boolean).join(' · ')}
        action={
          <Button
            title="Edit"
            variant="secondary"
            icon={<Pencil size={15} color={colors.teal} />}
            onPress={() => router.push({ pathname: '/add-product', params: { id: p.id } })}
          />
        }
      />
      <Card>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 15,
          }}
        >
          <Badge
            label={
              p.verification === 'source_checked'
                ? 'Source checked'
                : 'User-entered · not independently verified'
            }
            tone={p.verification === 'source_checked' ? 'green' : 'amber'}
          />
          <Badge label="Local catalog" tone="blue" />
        </View>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 24,
            marginVertical: 12,
          }}
        >
          <Detail label="Manufacturer" value={p.manufacturer} />
          <Detail label="Country of manufacture" value={p.country} />
          <Detail label="Pack size" value={p.pack_size} />
          <Detail label="Category" value={p.category} />
        </View>
        <Button
          title="Add to my medicines"
          icon={<Plus size={16} color="white" />}
          onPress={() =>
            router.push({
              pathname: '/inventory-entry',
              params: { productId: p.id },
            })
          }
        />
      </Card>
      <Section title="Active ingredients" />
      <Card>
        {p.ingredients.length ? (
          p.ingredients.map((i) => (
            <View
              key={i.name}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <Text
                style={{
                  color: colors.text,
                  fontSize: 14,
                  textTransform: 'capitalize',
                }}
              >
                {i.name}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 13 }}>
                {i.strength || 'Strength not recorded'}
              </Text>
            </View>
          ))
        ) : (
          <Text style={{ color: colors.muted }}>
            No ingredients recorded. Duplicate ingredient checks will be incomplete.
          </Text>
        )}
      </Card>
      <Section title="Packaging information" />
      <Card>
        <Detail label="General indications" value={p.indications} />
        <Detail label="Storage instructions" value={p.storage} />
        <Detail label="Safety warnings" value={p.warnings} />
        <Detail label="Prescription classification" value={p.prescription} />
      </Card>
      <Section title="Source & identifiers" />
      <Card>
        <Detail label="Information source" value={p.source} />
        <Detail label="Last verification date" value={p.verified_at ?? ''} />
        <Detail label="Registered identifiers" value={p.barcodes.join('\n')} />
      </Card>
      <Notice>
        MedTrace provides product information, not diagnosis, prescribing or personal dosage advice.
        Ask a qualified pharmacist if you are unsure about a medicine.
      </Notice>
    </Page>
  );
}
