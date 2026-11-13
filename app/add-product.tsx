import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { Page, Back, Heading, Card, Field, Button, Notice, Section } from '../src/components/ui';
import { useData } from '../src/data/context';
import { saveProduct } from '../src/data/products';
import type { Ingredient, ProductInput } from '../src/domain/types';
import { colors } from '../src/theme';
const blank: ProductInput = {
  name: '',
  generic_name: '',
  strength: '',
  dosage_form: '',
  manufacturer: '',
  country: '',
  category: '',
  pack_size: '',
  storage: '',
  warnings: '',
  indications: '',
  prescription: '',
  source: '',
  verified_at: null,
  verification: 'user_entered',
  ingredients: [],
  barcodes: [],
};
export default function AddProduct() {
  const { id, identifier } = useLocalSearchParams<{
    id?: string;
    identifier?: string;
  }>();
  const { db, products, mutate } = useData();
  const existing = products.find((p) => p.id === Number(id));
  const [form, setForm] = useState<ProductInput>(
    existing ?? { ...blank, barcodes: identifier ? [identifier] : [] },
  );
  const [identifiers, setIdentifiers] = useState(form.barcodes.join('\n')),
    [ingredients, setIngredients] = useState<Ingredient[]>(
      form.ingredients.length ? form.ingredients : [{ name: '', strength: '' }],
    );
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const set = (key: keyof ProductInput, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const field = (
    label: string,
    key: keyof ProductInput,
    placeholder: string,
    multiline = false,
  ) => (
    <Field
      label={label}
      value={String(form[key] ?? '')}
      onChangeText={(v) => set(key, v)}
      placeholder={placeholder}
      multiline={multiline}
    />
  );
  async function save() {
    setError('');
    setBusy(true);
    try {
      const productId = await mutate(() =>
        saveProduct(
          db,
          {
            ...form,
            ingredients,
            barcodes: identifiers
              .split(/[\n,]+/)
              .map((x) => x.trim())
              .filter(Boolean),
            verification: 'user_entered',
            verified_at: null,
          },
          existing?.id,
        ),
      );
      router.replace(`/product/${productId}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page>
      <Back />
      <Heading
        title={existing ? 'Edit product' : 'Register a product'}
        subtitle="Copy the exact product information from its packaging or a reliable source."
      />
      <Notice tone="amber">
        Local entries are labelled user-entered. Saving a record does not independently verify its
        medical information.
      </Notice>
      {Boolean(error) && <Notice tone="red">{error}</Notice>}
      <Section title="Product identity" />
      <Card>
        {field('Brand / product name *', 'name', 'As printed on the package')}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
          {field('Generic name', 'generic_name', 'As printed')}
          {field('Product strength', 'strength', 'e.g. amount per tablet')}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
          {field('Dosage form', 'dosage_form', 'Tablet, capsule, solution…')}
          {field('Pack size', 'pack_size', 'e.g. 10 tablets')}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
          {field('Manufacturer', 'manufacturer', 'Company name')}
          {field('Country of manufacture', 'country', 'As printed')}
        </View>
        {field('Category', 'category', 'Use a consistent category name')}
        <Field
          label="Product identifiers"
          value={identifiers}
          onChangeText={setIdentifiers}
          multiline
          placeholder="One barcode or product identifier per line"
          hint="Use the exact code for this strength and pack size. Website QR codes are not product identifiers."
        />
      </Card>
      <Section title="Active ingredients" />
      <Card>
        {ingredients.map((ingredient, index) => (
          <View key={index} style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
              <Field
                label={`Ingredient ${index + 1}`}
                value={ingredient.name}
                onChangeText={(v) =>
                  setIngredients((rows) =>
                    rows.map((r, i) => (i === index ? { ...r, name: v } : r)),
                  )
                }
                placeholder="Exact ingredient name"
              />
              <Field
                label="Amount / concentration"
                value={ingredient.strength}
                onChangeText={(v) =>
                  setIngredients((rows) =>
                    rows.map((r, i) => (i === index ? { ...r, strength: v } : r)),
                  )
                }
                placeholder="Include unit and basis"
              />
            </View>
            <Button
              title="Remove ingredient"
              variant="secondary"
              onPress={() => setIngredients((rows) => rows.filter((_, i) => i !== index))}
            />
          </View>
        ))}
        <Button
          title="Add ingredient"
          variant="secondary"
          icon={<Plus size={16} color={colors.teal} />}
          onPress={() => setIngredients((rows) => [...rows, { name: '', strength: '' }])}
        />
      </Card>
      <Section title="Source & label information" />
      <Card>
        {field(
          'Information source *',
          'source',
          'e.g. packaging inspected, manufacturer leaflet reference',
        )}
        {field('Storage instructions', 'storage', 'Copy the label wording', true)}
        {field(
          'Safety warnings',
          'warnings',
          'Copy sourced warnings; leave unknown details blank',
          true,
        )}
        {field(
          'General indications',
          'indications',
          'Only enter information supported by your source',
          true,
        )}
        {field(
          'Prescription classification',
          'prescription',
          'Leave blank unless supported by a local source',
        )}
      </Card>
      <Button
        title={existing ? 'Save changes' : 'Save product locally'}
        onPress={save}
        busy={busy}
      />
    </Page>
  );
}
