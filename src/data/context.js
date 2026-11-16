import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { listProducts } from './products.js';
import { listInventory } from './inventory.js';
import { listHistory } from './history.js';
import { flushPublications, listPublicationStates } from './publications.js';
import { catalogConfig } from '../cloud/config.js';
const Context = createContext(null);
export function DataProvider({ children }) {
  const db = useSQLiteContext();
  const [products, setProducts] = useState([]),
    [inventory, setInventory] = useState([]),
    [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const [publications, setPublications] = useState([]);
  const refresh = useCallback(async () => {
    try {
      const p = await listProducts(db);
      const i = await listInventory(db);
      const h = await listHistory(db);
      const uploads = await listPublicationStates(db);
      setProducts(p);
      setInventory(i);
      setHistory(h);
      setPublications(uploads);
      setError('');
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [db]);
  // Serialize writes so asynchronous SQLite transactions cannot overlap.
  const queue = useRef(Promise.resolve());
  const mutate = useCallback(
    (action) => {
      const next = queue.current.then(async () => {
        const result = await action();
        await refresh();
        return result;
      });
      queue.current = next.catch(() => undefined);
      return next;
    },
    [refresh],
  );
  const syncUploads = useCallback(
    () =>
      mutate(async () => {
        const config = catalogConfig();
        return config ? flushPublications(db, config) : 0;
      }),
    [db, mutate],
  );
  useEffect(() => {
    const retry = () => {
      void syncUploads().catch(() => undefined);
    };
    retry();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') retry();
    });
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') retry();
    }, 60000);
    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, [syncUploads]);
  useEffect(() => {
    void refresh().catch(() => undefined);
  }, [refresh]);
  return (
    <Context.Provider
      value={{
        db,
        products,
        inventory,
        history,
        publications,
        syncUploads,
        loading,
        error,
        refresh,
        mutate,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useData() {
  const value = useContext(Context);
  if (!value) throw new Error('Database provider is unavailable.');
  return value;
}
