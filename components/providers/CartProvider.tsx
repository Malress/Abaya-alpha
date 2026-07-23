"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { CartLine } from "@/lib/ordable/types";
import { cartCount, cartSubtotal, deriveLineId } from "@/lib/cart";

const STORAGE_KEY = "abaya_cart_v1";

interface CartContextValue {
  lines: CartLine[];
  count: number;
  subtotal: number;
  add: (line: Omit<CartLine, "lineId">) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  remove: (lineId: string) => void;
  clear: () => void;
  hydrated: boolean;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setLines(JSON.parse(raw));
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* quota / private mode — ignore */
    }
  }, [lines, hydrated]);

  const add = useCallback((line: Omit<CartLine, "lineId">) => {
    const lineId = deriveLineId(line.productId, line.options, line.bookingSlotId);
    setLines((prev) => {
      // no_mingling: a line from a mingling-locked category clears foreign lines.
      let base = prev;
      if (line.noMingling && line.categoryId != null) {
        base = prev.filter((l) => l.categoryId === line.categoryId);
      } else {
        const locked = prev.find((l) => l.noMingling && l.categoryId != null);
        if (locked && locked.categoryId !== line.categoryId) {
          base = [];
        }
      }
      const existing = base.find((l) => l.lineId === lineId);
      if (existing) {
        return base.map((l) =>
          l.lineId === lineId
            ? { ...l, quantity: Math.min(l.quantity + line.quantity, l.maxQuantity ?? 999) }
            : l,
        );
      }
      return [...base, { ...line, lineId }];
    });
  }, []);

  const setQuantity = useCallback((lineId: string, quantity: number) => {
    setLines((prev) =>
      quantity <= 0
        ? prev.filter((l) => l.lineId !== lineId)
        : prev.map((l) =>
            l.lineId === lineId
              ? { ...l, quantity: Math.min(quantity, l.maxQuantity ?? 999) }
              : l,
          ),
    );
  }, []);

  const remove = useCallback((lineId: string) => {
    setLines((prev) => prev.filter((l) => l.lineId !== lineId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      count: cartCount(lines),
      subtotal: cartSubtotal(lines),
      add,
      setQuantity,
      remove,
      clear,
      hydrated,
    }),
    [lines, add, setQuantity, remove, clear, hydrated],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
