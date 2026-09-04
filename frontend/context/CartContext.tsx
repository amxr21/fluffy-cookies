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
import { MENU } from "@/lib/menu";
import { lineTotalMinor, sumMinor } from "@/lib/money";

/**
 * Global cart state (per storefront template): server-backed + optimistic when
 * signed in, localStorage fallback for guests. Stateful actions gate on auth.
 */

export type AddToCartInput = Omit<CartLine, "quantity"> & { quantity?: number };

type CartContextValue = {
  lines: CartLine[];
  count: number;
  /** VAT-inclusive cart total in minor units (fils). */
  subtotalMinor: number;
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
  subtotalMinor: 0,
  hydrated: false,
  addToCart: async () => false,
  setQuantity: noop,
  removeFromCart: noop,
  clearCart: () => {},
});

/**
 * Guest carts persisted before `productId` existed hold only the slug, so a
 * returning guest would POST `product_id: undefined` and every write would
 * 422. Backfill from the menu and drop lines whose product no longer exists.
 */
function migrateGuestLines(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((line): CartLine[] => {
    if (!line || typeof line !== "object") return [];
    const l = line as Partial<CartLine>;
    if (typeof l.id !== "string") return [];
    if (typeof l.productId === "number") return [l as CartLine];

    const match = MENU.flatMap((c) => c.items).find((i) => i.id === l.id);
    return match ? [{ ...(l as CartLine), productId: match.productId }] : [];
  });
}

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
        if (raw) setLines(migrateGuestLines(JSON.parse(raw)));
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
        product_id: item.productId,
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
      // Callers address lines by slug; the API needs the numeric product id,
      // so capture it from the line before the state update drops it.
      let productId: number | undefined;
      setLines((prev) => {
        productId = prev.find((l) => l.id === id)?.productId;
        const next =
          q === 0
            ? prev.filter((l) => l.id !== id)
            : prev.map((l) => (l.id === id ? { ...l, quantity: q } : l));
        if (!getUserId()) persistGuest(next);
        return next;
      });
      const userId = getUserId();
      if (userId && productId !== undefined) {
        await patchJSON("/cart", {
          user_id: userId,
          product_id: productId,
          quantity: q,
        });
      }
    },
    [persistGuest]
  );

  const removeFromCart = useCallback(
    async (id: string) => {
      let productId: number | undefined;
      setLines((prev) => {
        productId = prev.find((l) => l.id === id)?.productId;
        const next = prev.filter((l) => l.id !== id);
        if (!getUserId()) persistGuest(next);
        return next;
      });
      const userId = getUserId();
      if (userId && productId !== undefined) {
        await deleteJSON("/cart", { user_id: userId, product_id: productId });
      }
    },
    [persistGuest]
  );

  const clearCart = useCallback(() => {
    setLines([]);
    persistGuest([]);
  }, [persistGuest]);

  const { count, subtotalMinor } = useMemo(
    () => ({
      count: lines.reduce((n, l) => n + l.quantity, 0),
      // Integer arithmetic throughout — see lib/money.ts.
      subtotalMinor: sumMinor(
        lines.map((l) => lineTotalMinor(l.priceMinor, l.quantity))
      ),
    }),
    [lines]
  );

  const value = useMemo(
    () => ({
      lines,
      count,
      subtotalMinor,
      hydrated,
      addToCart,
      setQuantity,
      removeFromCart,
      clearCart,
    }),
    [lines, count, subtotalMinor, hydrated, addToCart, setQuantity, removeFromCart, clearCart]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
