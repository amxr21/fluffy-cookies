"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useToast } from "@/components/providers/ToastProvider";
import { AUTH_KEYS } from "@/lib/config";
import { getJSON, postJSON, patchJSON, deleteJSON } from "@/lib/safeFetch";
import type { CartLine } from "@/lib/cart";

/**
 * Global cart state (per storefront template): server-backed + optimistic when
 * signed in, localStorage fallback for guests. Stateful actions gate on auth.
 */

export type AddToCartInput = Omit<CartLine, "quantity"> & { quantity?: number };

type CartContextValue = {
  lines: CartLine[];
  count: number;
  subtotal: number;
  hydrated: boolean;
  addToCart: (item: AddToCartInput) => Promise<boolean>;
  setQuantity: (id: string, quantity: number) => Promise<void>;
  removeFromCart: (id: string) => Promise<void>;
  clearCart: () => void;
};

const STORAGE_KEY = "fluffy_cart";

const noop = async () => {};
const CartContext = createContext<CartContextValue>({
  lines: [],
  count: 0,
  subtotal: 0,
  hydrated: false,
  addToCart: async () => false,
  setQuantity: noop,
  removeFromCart: noop,
  clearCart: () => {},
});

const getUserId = () =>
  typeof window !== "undefined" ? localStorage.getItem(AUTH_KEYS.userId) : null;

export function CartProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const persistGuest = useCallback((next: CartLine[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* quota */
    }
  }, []);

  // hydrate: from API if signed in, else localStorage
  useEffect(() => {
    const userId = getUserId();
    if (!userId) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) setLines(JSON.parse(raw));
      } catch {
        /* ignore */
      }
      setHydrated(true);
      return;
    }
    let active = true;
    (async () => {
      const res = await getJSON<CartLine[]>(`/cart/${userId}`);
      if (!active) return;
      if (res.ok && Array.isArray(res.data)) setLines(res.data);
      setHydrated(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  const addToCart = useCallback(
    async (item: AddToCartInput): Promise<boolean> => {
      const qty = item.quantity ?? 1;
      const userId = getUserId();

      // guest: local-only cart
      if (!userId) {
        setLines((prev) => {
          const existing = prev.find((l) => l.id === item.id);
          const next = existing
            ? prev.map((l) =>
                l.id === item.id ? { ...l, quantity: l.quantity + qty } : l
              )
            : [...prev, { ...item, quantity: qty }];
          persistGuest(next);
          return next;
        });
        toast.success("Added to your cart", {
          title: "🛒 In your cart",
          action: { label: "Check Cart", href: "/cart" },
        });
        return true;
      }

      // signed in: optimistic + server
      setLines((prev) => {
        const existing = prev.find((l) => l.id === item.id);
        return existing
          ? prev.map((l) =>
              l.id === item.id ? { ...l, quantity: l.quantity + qty } : l
            )
          : [...prev, { ...item, quantity: qty }];
      });
      const res = await postJSON("/cart", {
        user_id: userId,
        product_id: item.id,
        quantity: qty,
      });
      if (!res.ok) {
        toast.error(res.error.message || "Couldn't add the item");
        return false;
      }
      toast.success("Added to your cart", {
        title: "🛒 In your cart",
        action: { label: "Check Cart", href: "/cart" },
      });
      return true;
    },
    [persistGuest, toast]
  );

  const setQuantity = useCallback(
    async (id: string, quantity: number) => {
      const q = Math.max(0, quantity);
      setLines((prev) => {
        const next =
          q === 0
            ? prev.filter((l) => l.id !== id)
            : prev.map((l) => (l.id === id ? { ...l, quantity: q } : l));
        if (!getUserId()) persistGuest(next);
        return next;
      });
      const userId = getUserId();
      if (userId) {
        await patchJSON("/cart", { user_id: userId, product_id: id, quantity: q });
      }
    },
    [persistGuest]
  );

  const removeFromCart = useCallback(
    async (id: string) => {
      setLines((prev) => {
        const next = prev.filter((l) => l.id !== id);
        if (!getUserId()) persistGuest(next);
        return next;
      });
      const userId = getUserId();
      if (userId) {
        await deleteJSON("/cart", { user_id: userId, product_id: id });
      }
    },
    [persistGuest]
  );

  const clearCart = useCallback(() => {
    setLines([]);
    persistGuest([]);
  }, [persistGuest]);

  const { count, subtotal } = useMemo(
    () => ({
      count: lines.reduce((n, l) => n + l.quantity, 0),
      subtotal: lines.reduce((s, l) => s + l.price * l.quantity, 0),
    }),
    [lines]
  );

  const value = useMemo(
    () => ({
      lines,
      count,
      subtotal,
      hydrated,
      addToCart,
      setQuantity,
      removeFromCart,
      clearCart,
    }),
    [lines, count, subtotal, hydrated, addToCart, setQuantity, removeFromCart, clearCart]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
