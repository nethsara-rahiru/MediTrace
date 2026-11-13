import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, ScanLine, CircleHelp } from 'lucide-react-native';
import { Page, Back, Heading, Card, Badge, Button, Notice } from '../src/components/ui';
import { ProductCard } from '../src/components/ProductCard';
import { useData } from '../src/data/context';
import { findProduct } from '../src/data/products';
import { recordScan } from '../src/data/history';
import { decodeScan } from '../src/domain/scan';
import { formatExpiry } from '../src/domain/expiry';
import type { Product } from '../src/domain/types';
import { colors } from '../src/theme';
function ScanResultContent() {
  const { raw = '', format = 'manual' } = useLocalSearchParams<{
    raw: string;
    format: string;
  }>();
  const { db, mutate } = useData();
  const decoded = decodeScan(raw, format);
  const [product, setProduct] = useState<Product | null>(null),
    [busy, setBusy] = useState(true),
    [error, setError] = useState('');
  const work = useRef<Promise<Product | null> | null>(null);
  useEffect(() => {
    let active = true;
    if (!work.current)
      work.current = mutate(async () => {
        const p = decoded.identifier ? await findProduct(db, decoded.identifier) : null;
        await recordScan(db, decoded, p?.id ?? null);
        return p;
      });
    work.current
      .then((p) => {
        if (active) {
          setProduct(p);
          setBusy(false);
        }
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setBusy(false);
        }
      });
    return () => {
      active = false;
    };
  }, [db, mutate]);
  const isGS1Candidate =
    ['datamatrix', 'code128'].includes(format) && /^01\d{14}/.test(raw) && decoded.kind !== 'gs1';
  return (
    <Page>
      <Back label="Scanner" />
      <Heading
        title="Scan result"
        subtitle="Decoded on your device. Matched against your local SQLite catalog."
      />
      {busy ? (
        <Card>
          <ActivityIndicator color={colors.teal} />
          <Text style={{ textAlign: 'center', color: colors.muted }}>
            Checking the local library…
          </Text>
        </Card>
      ) : (
        <>
          <Card>
            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
              <View
                style={{
                  padding: 13,
                  borderRadius: 15,
                  backgroundColor: product ? colors.mint : colors.amberBg,
                }}
              >
                {product ? (
                  <Check color={colors.teal} size={25} />
                ) : (
                  <CircleHelp color={colors.amber} size={25} />
                )}
              </View>
              <View style={{ flex: 1, gap: 7 }}>
                <Text
                  style={{
                    color: colors.navy,
                    fontSize: 21,
                    fontWeight: '700',
                  }}
                >
                  {error
                    ? 'Lookup unavailable'
                    : product
                      ? 'Catalog match'
                      : decoded.kind === 'url'
                        ? 'Website QR code'
                        : decoded.notes.length
                          ? 'Scan needs review'
                          : 'Unknown product'}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 19 }}>
                  {product
                    ? 'An exact identifier matched a locally stored product.'
                    : 'No reliable product identification has been established.'}
                </Text>
              </View>
            </View>
            <Badge label={format.toUpperCase()} tone="blue" />
            <Text style={{ color: colors.muted, fontSize: 11 }}>PRODUCT IDENTIFIER</Text>
            <Text
              selectable
              style={{
                fontSize: 17,
                color: colors.navy,
                fontFamily: 'monospace',
              }}
            >
              {decoded.identifier ?? 'Not available'}
            </Text>
            {decoded.kind === 'url' && (
              <Text selectable style={{ color: colors.muted, fontSize: 12 }}>
                {raw}
              </Text>
            )}
          </Card>
          {Boolean(error) && <Notice tone="red">{error}</Notice>}
          {decoded.notes.map((note, i) => (
            <Notice key={i} tone="amber">
              {note}
            </Notice>
          ))}
          {isGS1Candidate && (
            <Card>
              <Text style={{ color: colors.text, lineHeight: 22 }}>
                This scanner returned content that may be GS1 without a symbology indicator. If the
                package identifies it as GS1, you can explicitly interpret its application
                identifiers.
              </Text>
              <Button
                title="Interpret as GS1"
                variant="secondary"
                onPress={() =>
                  router.replace({
                    pathname: '/scan-result',
                    params: { raw, format: 'gs1', attempt: String(Date.now()) },
                  })
                }
              />
            </Card>
          )}
          {product && <ProductCard product={product} />}
          <Card>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.navy }}>
              Package-specific fields
            </Text>
            {[
              ['Batch / lot', decoded.batch],
              [
                'Expiry',
                decoded.expiry ? formatExpiry(decoded.expiry, decoded.expiryPrecision) : undefined,
              ],
              ['Serial number', decoded.serial],
            ].map(([label, value]) => (
              <View
                key={label}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  gap: 15,
                }}
              >
                <Text style={{ fontSize: 13, color: colors.muted }}>{label}</Text>
                <Text
                  selectable
                  style={{
                    fontSize: 13,
                    color: colors.text,
                    flex: 1,
                    textAlign: 'right',
                  }}
                >
                  {value ?? 'Not encoded / not available'}
                </Text>
              </View>
            ))}
            <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 18 }}>
              Decoded fields describe what the code contains. Confirm them against the printed
              package.
            </Text>
          </Card>
          {product ? (
            <Button
              title="Add this pack to my medicines"
              onPress={() =>
                router.push({
                  pathname: '/inventory-entry',
                  params: {
                    productId: product.id,
                    batch: decoded.batch ?? '',
                    expiry: decoded.expiry ?? '',
                    expiryPrecision: decoded.expiryPrecision ?? 'unknown',
                  },
                })
              }
            />
          ) : (
            <>
              <Button title="Search medicine library" onPress={() => router.push('/library')} />
              {decoded.identifier && decoded.identifier.length <= 256 && (
                <Button
                  title="Register this product"
                  variant="secondary"
                  onPress={() =>
                    router.push({
                      pathname: '/add-product',
                      params: { identifier: decoded.identifier! },
                    })
                  }
                />
              )}
            </>
          )}
          <Button
            title="Scan another package"
            variant="secondary"
            icon={<ScanLine size={17} color={colors.teal} />}
            onPress={() => router.replace('/scanner')}
          />
          <Notice>
            A barcode match does not prove authenticity. MedTrace does not establish whether a
            medicine is safe for you.
          </Notice>
        </>
      )}
    </Page>
  );
}

export default function ScanResult() {
  const { raw, format } = useLocalSearchParams<{
    raw: string;
    format: string;
  }>();
  return <ScanResultContent key={`${format}:${raw}`} />;
}
