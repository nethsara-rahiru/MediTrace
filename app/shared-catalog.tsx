import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { Back, Button, Card, Heading, Notice, Page } from '../src/components/ui';
import { useData } from '../src/data/context';
import { catalogConfig } from '../src/cloud/config';
import { downloadCatalog } from '../src/data/catalog';
import { colors } from '../src/theme';
export default function SharedCatalog() {
  const { db, mutate } = useData();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [last, setLast] = useState('');
  let config: ReturnType<typeof catalogConfig> = null,
    configurationError = '';
  try {
    config = catalogConfig();
  } catch (e) {
    configurationError = (e as Error).message;
  }
  const projectUrl = config?.url;
  useEffect(() => {
    let active = true;
    if (projectUrl)
      void db
        .getFirstAsync<{ value: string }>(
          'SELECT value FROM preferences WHERE key=?',
          `catalog_last_download:${projectUrl}`,
        )
        .then((row) => {
          if (active) setLast(row?.value ?? '');
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [db, projectUrl]);
  async function download() {
    if (!config) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await mutate(() => downloadCatalog(db, config!));
      setLast(new Date().toISOString());
      setMessage(
        `${result.added} added · ${result.updated} refreshed · ${result.withdrawn} withdrawn · ${result.conflicts} conflicts kept unchanged.`,
      );
    } catch (e) {
      setError(`${(e as Error).message} Existing local products remain available.`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page>
      <Back label="Medicine library" />
      <Heading
        title="Shared catalog"
        subtitle="Download reviewed medicine information for future offline scans."
      />
      <Card>
        <Text style={{ color: colors.navy, fontSize: 18, fontWeight: '700' }}>
          Your offline library stays with you
        </Text>
        <Text style={{ color: colors.muted, lineHeight: 23 }}>
          This connects to the shared MedTrace catalog. Your personal medicines, scan history and
          photographs stay on this device. Downloads use an internet connection.
        </Text>
        <Text style={{ color: colors.muted }}>
          Last successful download: {last ? new Date(last).toLocaleString() : 'Not downloaded yet'}
        </Text>
        <Button
          title="Download catalog updates"
          busy={busy}
          disabled={!config}
          onPress={() => void download()}
        />
      </Card>
      {(!config || configurationError) && (
        <Notice tone="amber">
          {configurationError ||
            'The shared catalog is not configured in this app build. Your offline library is available.'}
        </Notice>
      )}
      {Boolean(error) && <Notice tone="red">{error}</Notice>}
      {Boolean(message) && <Notice>{message}</Notice>}
      <Notice>
        Downloaded records retain their source and review date. A match does not prove authenticity
        or suitability. Locally edited products and conflicting barcode mappings are preserved for
        review. Withdrawn records lose automatic barcode matching when they have not been edited
        locally.
      </Notice>
    </Page>
  );
}
