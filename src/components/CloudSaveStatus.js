import { router } from 'expo-router';
import { useData } from '../data/context.js';
import { catalogConfig } from '../cloud/config.js';
import { Button, Card, Notice } from './ui.js';
export function CloudSaveStatus({ productId }) {
  const { publications } = useData();
  let project;
  try {
    project = catalogConfig()?.url;
  } catch {
    return null;
  }
  const state = publications.find((p) => p.product_id === productId && p.project_url === project);
  if (!state) return null;
  return (
    <Card>
      <Notice tone={state.pending ? 'amber' : 'neutral'}>
        {state.pending
          ? `Saved on this device. Online save pending.${state.last_error ? ` ${state.last_error}` : ' Upload will retry when a connection is available.'}`
          : 'Saved on this device and in the shared online catalog. Shared information is labelled user-entered.'}
      </Notice>
      {Boolean(state.pending) && (
        <Button
          title="Manage online saves"
          variant="secondary"
          onPress={() => router.push('/shared-catalog')}
        />
      )}
    </Card>
  );
}
