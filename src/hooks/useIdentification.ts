import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useData } from '../data/context';
import { getSession } from '../data/identification';
import type { Session } from '../domain/extraction/types';
export function useIdentification(id: number) {
  const { db, mutate } = useData();
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const reload = useCallback(async () => {
    try {
      const value = await getSession(db, id);
      setSession(value);
      setError(value ? '' : 'Scan session not found.');
      return value;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [db, id]);
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );
  return { db, mutate, session, setSession, loading, error, setError, reload };
}
