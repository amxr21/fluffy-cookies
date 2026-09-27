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
import { dashboardCartToLines, dashboardDelete, dashboardGet, dashboardPatch, dashboardPost, type DashboardCart } from "@/lib/dashboard";
import { useAuth } from "@/context/AuthContext";
import type { CartLine } from "@/lib/cart";
import { lineTotalMinor, sumMinor } from "@/lib/money";

/**
 * Global cart state: the dashboard's saved cart when signed in, localStorage
 * for guests.
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
 * Keep only guest lines the dashboard can sell. Carts saved by the retired
 * Fluffy API carry numeric product IDs (or none); the dashboard's are strings,
 * and a numeric one would fail every checkout.
 */
function migrateGuestLines(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((line): CartLine[] => {
    if (!line || typeof line !== "object") return [];
    const l = line as Partial<CartLine>;
    if (typeof l.id !== "string") return [];
    return typeof l.productId === "string" ? [l as CartLine] : [];
  });
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  const { user, hydrated: authHydrated } = useAuth();
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
    if (!authHydrated) return;
    const userId = user?.userId;
    if (!userId) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        // Guest cart is in localStorage, readable only after mount.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (raw) setLines(migrateGuestLines(JSON.parse(raw)));
      } catch {
        /* ignore */
      }
      setHydrated(true);
      return;
    }
    let active = true;
    (async () => {
      const res = await dashboardGet<DashboardCart>("/cart");
      if (!active) return;
      if (res.ok) {
        try { setLines(dashboardCartToLines(res.data)); }
        catch { toast.error("Couldn't read your cart."); }
      } else toast.error(res.error.message);
      setHydrated(true);
    })();
    return () => {
      active = false;
    };
  }, [user?.userId, authHydrated, toast]);

  const addToCart = useCallback(
    async (item: AddToCartInput): Promise<boolean> => {
      const qty = item.quantity ?? 1;
      // guest: local-only cart
      if (!user) {
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

      const res = await dashboardPost<DashboardCart>("/cart", { productId: String(item.productId), quantity: qty });
      if (!res.ok) {
        toast.error(res.error.message || "Couldn't add the item");
        return false;
      }
      try { setLines(dashboardCartToLines(res.data)); }
      catch { toast.error("Couldn't read your updated cart."); return false; }
      toast.success("Added to your cart", { title: "In your cart", action: { label: "Check Cart", href: "/cart" } });
      return true;
    },
    [persistGuest, toast, user]
  );

  const setQuantity = useCallback(
    async (id: string, quantity: number) => {
      const q = Math.max(0, quantity);
      if (user) {
        const productId = lines.find((line) => line.id === id)?.productId;
        if (productId === undefined) return;
        const res = await dashboardPatch<DashboardCart>("/cart", { productId: String(productId), quantity: q });
        if (res.ok) {
          try { setLines(dashboardCartToLines(res.data)); }
          catch { toast.error("Couldn't read your updated cart."); }
        } else toast.error(res.error.message);
        return;
      }
      setLines((prev) => {
        const next =
          q === 0
            ? prev.filter((l) => l.id !== id)
            : prev.map((l) => (l.id === id ? { ...l, quantity: q } : l));
        persistGuest(next);
        return next;
      });
    },
    [persistGuest, user, lines, toast]
  );

  const removeFromCart = useCallback(
    async (id: string) => {
      if (user) {
        const productId = lines.find((line) => line.id === id)?.productId;
        if (productId === undefined) return;
        const res = await dashboardDelete<DashboardCart>("/cart", { productId: String(productId) });
        if (res.ok) {
          try { setLines(dashboardCartToLines(res.data)); }
          catch { toast.error("Couldn't read your updated cart."); }
        } else toast.error(res.error.message);
        return;
      }
      setLines((prev) => {
        const next = prev.filter((l) => l.id !== id);
        persistGuest(next);
        return next;
      });
    },
    [persistGuest, user, lines, toast]
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
