import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Page, Heading, Card, Notice, Button } from '../src/components/ui';
import { useData } from '../src/data/context';
import { beginIdentification } from '../src/data/identification';
import { colors } from '../src/theme';
function ScanGatewayContent() {
  const {
    raw = '',
    format = 'manual',
    token,
  } = useLocalSearchParams<{ raw: string; format: string; token?: string }>();
  const { db, mutate } = useData();
  const [error, setError] = useState('');
  const sessionToken = useRef(
    token ?? `scan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
  );
  const work = useRef<Promise<number> | null>(null);
  useEffect(() => {
    let active = true;
    if (!work.current)
      work.current = mutate(() => beginIdentification(db, raw, format, sessionToken.current));
    work.current
      .then((id) => {
        if (active) router.replace(`/identify/${id}`);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [db, mutate, raw, format]);
  return (
    <Page>
      <Heading
        title="Reading your medicine code"
        subtitle="Checking local records and extracting possible fields on this device."
      />
      {error ? (
        <>
          <Notice tone="red">{error}</Notice>
          <Button title="Scan again" onPress={() => router.replace('/scanner')} />
        </>
      ) : (
        <Card>
          <ActivityIndicator size="large" color={colors.teal} />
          <Text style={{ textAlign: 'center', color: colors.muted, lineHeight: 22 }}>
            Checking the local library…{'\n'}Reading packaging fields…
          </Text>
        </Card>
      )}
    </Page>
  );
}

export default function ScanGateway() {
  const { raw, format, token } = useLocalSearchParams<{
    raw: string;
    format: string;
    token?: string;
  }>();
  return <ScanGatewayContent key={`${token ?? ''}:${format}:${raw}`} />;
}
