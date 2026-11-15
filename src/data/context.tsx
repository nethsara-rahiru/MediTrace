import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { InventoryItem, Product, Scan } from '../domain/types';
import { listProducts } from './products';
import { listInventory } from './inventory';
import { listHistory } from './history';
import { flushPublications, listPublicationStates, type PublicationState } from './publications';
import { catalogConfig } from '../cloud/config';
const Context = createContext<{
  db: SQLiteDatabase;
  products: Product[];
  inventory: InventoryItem[];
  history: Scan[];
  publications: PublicationState[];
  syncUploads: () => Promise<number>;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  mutate: <T>(action: () => Promise<T>) => Promise<T>;
} | null>(null);
export function DataProvider({ children }: React.PropsWithChildren) {
  const db = useSQLiteContext();
  const [products, setProducts] = useState<Product[]>([]),
    [inventory, setInventory] = useState<InventoryItem[]>([]),
    [history, setHistory] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const [publications, setPublications] = useState<PublicationState[]>([]);
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
      setError((e as Error).message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [db]);
  // Serialize writes so asynchronous SQLite transactions cannot overlap.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const mutate = useCallback(
    <T,>(action: () => Promise<T>): Promise<T> => {
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
