import { useEffect, useRef, useState } from 'react';
import { useData } from '../data/context.js';
import { catalogConfig } from '../cloud/config.js';
import {
  needsOnlineIdentity,
  findOnlineIdentity,
  storeOnlineIdentity,
} from '../data/onlineIdentity.js';
export function useOnlineIdentity(session, setSession) {
  const { db, mutate } = useData();
  const [checking, setChecking] = useState(false),
    [attempt, setAttempt] = useState(0),
    [error, setError] = useState('');
  const current = useRef(session);
  current.current = session;
  const scanId = session?.id,
    state = session?.state,
    identifier = session?.original.fields.gtin.value;
  useEffect(() => {
    const session = current.current;
    if (!session || !needsOnlineIdentity(session)) {
      setChecking(false);
      return;
    }
    const cached = session.onlineIdentity;
    if (
      attempt === 0 &&
      cached &&
      cached.status !== 'unavailable' &&
      Date.now() - Date.parse(cached.checkedAt) < 60000
    )
      return;
    let active = true;
    const controller = new AbortController();
    setChecking(true);
    setError('');
    void (async () => {
      const result = await findOnlineIdentity(session, catalogConfig(), controller.signal);
      if (!active) return;
      const updated = await mutate(() =>
        active ? storeOnlineIdentity(db, session.id, result) : Promise.resolve(null),
      );
      if (active && updated) setSession(updated);
    })()
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [scanId, state, identifier, attempt, db, mutate, setSession]);
  const lookup = session?.onlineIdentity,
    product = lookup?.status === 'matched' ? lookup.record?.product : null;
  const suggestion = product
    ? {
        key: `online:${lookup.record.id}`,
        productId: null,
        name: product.name,
        strength: product.strength || null,
        dosageForm: product.dosage_form || null,
        packSize: product.pack_size || null,
        score: 1,
        reason: 'Exact online identifier match',
      }
    : null;
  return { checking, error, suggestion, lookup, retry: () => setAttempt((n) => n + 1) };
}
