import { useEffect, useRef, useState } from 'react';
import { catalogConfig } from '../cloud/config.js';
import { identityKey } from '../domain/catalogCheck.js';
import { checkConfirmedMedicine, applyOnlineCheck } from '../data/onlineIdentification.js';
import { useData } from '../data/context.js';
export function useOnlineMedicine(session, setSession, dirty, blocked = false) {
  const { db, mutate } = useData();
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false),
    [attempt, setAttempt] = useState(0);
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const protectedFields = useRef(new Set());
  const key = session?.identity ? identityKey(session.identity) : '';
  const id = session?.id,
    state = session?.state;
  const snapshot = useRef(session);
  snapshot.current = session;
  useEffect(() => {
    protectedFields.current.clear();
    const current = snapshot.current;
    if (!current || state !== 'identity_confirmed' || !current.identity) {
      setChecking(false);
      return;
    }
    const cached = current.onlineCheck;
    if (
      attempt === 0 &&
      cached &&
      cached.identityKey === key &&
      cached.status !== 'unavailable' &&
      Date.now() - Date.parse(cached.checkedAt) < 60000
    ) {
      setChecking(false);
      return;
    }
    let active = true;
    const controller = new AbortController();
    setChecking(true);
    setError('');
    void (async () => {
      try {
        const config = catalogConfig();
        const result = await checkConfirmedMedicine(db, current, config, controller.signal);
        if (!active) return;
        const updated = await mutate(() =>
          active && !blockedRef.current
            ? applyOnlineCheck(db, current.id, result, config.url, [
                ...dirtyRef.current,
                ...protectedFields.current,
              ])
            : Promise.resolve(null),
        );
        if (active && updated) setSession(updated);
      } finally {
        if (active) setChecking(false);
      }
    })().catch((e) => {
      if (active) {
        setChecking(false);
        setError(
          e instanceof Error
            ? e.message
            : 'Online comparison could not be saved. Local data remains available.',
        );
      }
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [id, key, state, attempt, db, mutate, setSession]);
  return {
    checking,
    error,
    retry: () => setAttempt((n) => n + 1),
    protect: (field) => protectedFields.current.add(field),
  };
}
