"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type CartItem = {
  key: string;
  productId: number;
  slug: string;
  name: string;
  imageId: string | null;
  unitPriceCents: number;
  qty: number;
  optionIds: number[];
  optionLabels: string[];
};

type CartCtx = {
  items: CartItem[];
  ready: boolean;
  count: number;
  subtotalCents: number;
  add: (item: Omit<CartItem, "key">) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
};

const STORAGE = "mk_cart_v1";
const Ctx = createContext<CartCtx | null>(null);

const keyOf = (productId: number, optionIds: number[]) => `${productId}:${[...optionIds].sort((a, b) => a - b).join(",")}`;

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      /* stockage indisponible : panier en mémoire */
    }
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE) {
        try {
          setItems(e.newValue ? JSON.parse(e.newValue) : []);
        } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE, JSON.stringify(items));
    } catch {}
  }, [items, ready]);

  const add = useCallback((item: Omit<CartItem, "key">) => {
    const key = keyOf(item.productId, item.optionIds);
    setItems((cur) => {
      const ex = cur.find((i) => i.key === key);
      if (ex) return cur.map((i) => (i.key === key ? { ...i, qty: Math.min(50, i.qty + item.qty), unitPriceCents: item.unitPriceCents } : i));
      return [...cur, { ...item, key }];
    });
  }, []);
  const setQty = useCallback((key: string, qty: number) => {
    setItems((cur) => (qty <= 0 ? cur.filter((i) => i.key !== key) : cur.map((i) => (i.key === key ? { ...i, qty: Math.min(50, qty) } : i))));
  }, []);
  const remove = useCallback((key: string) => setItems((cur) => cur.filter((i) => i.key !== key)), []);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({
      items,
      ready,
      add,
      setQty,
      remove,
      clear,
      count: items.reduce((n, i) => n + i.qty, 0),
      subtotalCents: items.reduce((n, i) => n + i.qty * i.unitPriceCents, 0),
    }),
    [items, ready, add, setQty, remove, clear],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart hors CartProvider");
  return c;
}
