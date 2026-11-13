import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useSQLiteContext } from "expo-sqlite";
import type { SQLiteDatabase } from "expo-sqlite";
import type { InventoryItem, Product, Scan } from "../domain/types";
import { listProducts } from "./products";
import { listInventory } from "./inventory";
import { listHistory } from "./history";
const Context = createContext<{
  db: SQLiteDatabase;
  products: Product[];
  inventory: InventoryItem[];
  history: Scan[];
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
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const p = await listProducts(db);
      const i = await listInventory(db);
      const h = await listHistory(db);
      setProducts(p);
      setInventory(i);
      setHistory(h);
      setError("");
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
  if (!value) throw new Error("Database provider is unavailable.");
  return value;
}
