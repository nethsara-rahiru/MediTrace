import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useData } from '../data/context.js';
import { getSession } from '../data/identification.js';
export function useIdentification(id) {
  const { db, mutate } = useData();
  const [session, setSession] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const reload = useCallback(async () => {
    try {
      const value = await getSession(db, id);
      setSession(value);
      setError(value ? '' : 'Scan session not found.');
      return value;
    } catch (e) {
      setError(e.message);
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
