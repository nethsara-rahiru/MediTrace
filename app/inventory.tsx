import { useState } from 'react';
import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { Page, Heading, Button, Field, Chips, Notice, Empty, Section } from '../src/components/ui';
import { InventoryCard } from '../src/components/InventoryCard';
import { useData } from '../src/data/context';
import { expiryState } from '../src/domain/expiry';
import { ingredientOverlaps } from '../src/domain/overlap';
export default function Inventory() {
  const { inventory } = useData();
  const [query, setQuery] = useState(''),
    [filter, setFilter] = useState('All');
  const q = query.toLowerCase().trim(),
    rows = inventory.filter(
      (i) =>
        (filter === 'All' || expiryState(i.expiry) === filter) &&
        [i.name, i.generic_name, i.batch, ...i.ingredients.map((x) => x.name)]
          .join(' ')
          .toLowerCase()
          .includes(q),
    );
  const overlaps = ingredientOverlaps(inventory);
  return (
    <Page>
      <Heading
        title="My medicines"
        subtitle="A little organisation. A clearer picture of your medicine cabinet."
        action={
          <Button
            title="Add medicine"
            icon={<Plus size={16} color="white" />}
            onPress={() => router.push('/inventory-entry')}
          />
        }
      />
      {overlaps.map((o) => (
        <Notice tone="amber" key={o.ingredient}>
          Recorded ingredient overlap: {o.ingredient} appears in{' '}
          {o.medicines.map((m) => m.name).join(' and ')}. Ask a pharmacist before using them
          together. This is not an interaction assessment.
        </Notice>
      ))}
      <Field
        label="Search your medicines"
        placeholder="Medicine name, ingredient or batch…"
        value={query}
        onChangeText={setQuery}
      />
      <Chips
        items={['All', 'Valid', 'Expiring soon', 'Expired', 'Expiry unknown']}
        value={filter}
        onChange={setFilter}
      />
      <Section
        title={`${rows.length} inventory ${rows.length === 1 ? 'entry' : 'entries'}`}
        action="Expiry tracker"
        onPress={() => router.push('/expiry')}
      />
      {rows.map((i) => (
        <InventoryCard key={i.id} item={i} />
      ))}
      {!rows.length && (
        <Empty
          title={inventory.length ? 'No matching entries' : 'Your medicine cabinet starts here'}
          description="Choose a product from your library and record the pack you own, including its batch and expiry."
          action={
            <Button
              title="Add your first medicine"
              onPress={() => router.push('/inventory-entry')}
            />
          }
        />
      )}
      <Notice>
        Ingredient checks use recorded ingredient names only. Missing information, spelling
        differences and salt forms may prevent matches.
      </Notice>
    </Page>
  );
}
