import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Plus, Search } from 'lucide-react-native';
import { router } from 'expo-router';
import { Page, Heading, Button, Field, Chips, Empty, Notice } from '../src/components/ui';
import { ProductCard } from '../src/components/ProductCard';
import { useData } from '../src/data/context';
import { listProducts } from '../src/data/products';
import type { Product } from '../src/domain/types';
import { colors } from '../src/theme';
export default function Library() {
  const { db, products } = useData();
  const [query, setQuery] = useState(''),
    [category, setCategory] = useState('All'),
    [manufacturer, setManufacturer] = useState('All'),
    [results, setResults] = useState<Product[]>(products),
    [error, setError] = useState('');
  const categories = ['All', ...new Set(products.map((p) => p.category))],
    manufacturers = ['All', ...new Set(products.map((p) => p.manufacturer).filter(Boolean))];
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      listProducts(db, query, category, manufacturer)
        .then((rows) => {
          if (active) {
            setResults(rows);
            setError('');
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [db, query, category, manufacturer, products]);
  return (
    <Page>
      <Heading
        title="Medicine library"
        subtitle="Your locally stored product reference. Available without internet."
        action={
          <Button
            title="Add product"
            icon={<Plus size={16} color="white" />}
            onPress={() => router.push('/add-product')}
          />
        }
      />
      <Field
        label="Search the library"
        placeholder="Brand, generic name, ingredient or strength…"
        value={query}
        onChangeText={setQuery}
      />
      <Chips items={categories} value={category} onChange={setCategory} />
      {manufacturers.length > 1 && (
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 12, color: colors.muted }}>Manufacturer</Text>
          <Chips items={manufacturers} value={manufacturer} onChange={setManufacturer} />
        </View>
      )}
      <Text style={{ fontSize: 12, color: colors.muted }}>
        {results.length} {results.length === 1 ? 'product' : 'products'} · Stored on this device
      </Text>
      {error && <Notice tone="red">{error}</Notice>}
      {results.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
      {!results.length && (
        <Empty
          title={products.length ? 'No matching products' : 'Build your medicine library'}
          description={
            products.length
              ? 'Try another name, ingredient or filter.'
              : 'Register a product from its packaging. Its identifier will be available for future offline scans.'
          }
          action={<Button title="Register a product" onPress={() => router.push('/add-product')} />}
        />
      )}
      <Notice>
        Product information retains its source status. A catalog match does not establish
        authenticity or suitability for a person.
      </Notice>
    </Page>
  );
}
