"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useToast } from "@/components/providers/ToastProvider";
import { dashboardCartToLines, dashboardDelete, dashboardGet, dashboardPatch, dashboardPost, type DashboardCart } from "@/lib/dashboard";
import { useAuth } from "@/context/AuthContext";
import type { CartLine } from "@/lib/cart";
import { lineTotalMinor, sumMinor } from "@/lib/money";
import { GUEST_CART_KEY, GUEST_TRANSFER_KEY, mergeGuestCart, readGuestCart } from "@/lib/guestCart";

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

const STORAGE_KEY = GUEST_CART_KEY;

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

export function CartProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  const { user, hydrated: authHydrated } = useAuth();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const currentUser = useRef<string | undefined>(undefined);

  useEffect(() => { currentUser.current = user?.userId; }, [user?.userId]);

  const persistGuest = useCallback((next: CartLine[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      if (next.length === 0) localStorage.removeItem(GUEST_TRANSFER_KEY);
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
        // Guest cart is in localStorage, readable only after mount.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLines(readGuestCart(localStorage));
      } catch {
        setLines([]);
      }
      setHydrated(true);
      return;
    }
    setHydrated(false);
    setLines([]);
    let active = true;
    void (async () => {
      try {
        const { cart, skipped } = await mergeGuestCart(userId, localStorage, () => currentUser.current === userId);
        if (active) setLines(dashboardCartToLines(cart));
        if (active && skipped.length > 0) {
          toast.info(`${skipped.join(", ")} ${skipped.length === 1 ? "is" : "are"} no longer available, so ${skipped.length === 1 ? "it wasn't" : "they weren't"} added to your cart.`);
        }
      } catch {
        if (!active) return;
        toast.error("Couldn't save all your guest items. They are kept on this device; sign in again to retry.");
        try {
          const res = await dashboardGet<DashboardCart>("/cart");
          if (!active) return;
          if (res.ok) setLines(dashboardCartToLines(res.data));
          else toast.error(res.error.message);
        } catch {
          if (active) toast.error("Couldn't read your cart. Please try again in a moment.");
        }
      } finally {
        if (active) setHydrated(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [user?.userId, authHydrated, toast]);

  const addToCart = useCallback(
    async (item: AddToCartInput): Promise<boolean> => {
      if (!hydrated) {
        toast.error("Your cart is still loading. Please try again in a moment.");
        return false;
      }
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
    [persistGuest, toast, user, hydrated]
  );

  const setQuantity = useCallback(
    async (id: string, quantity: number) => {
      if (!hydrated) return;
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
    [persistGuest, user, lines, toast, hydrated]
  );

  const removeFromCart = useCallback(
    async (id: string) => {
      if (!hydrated) return;
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
    [persistGuest, user, lines, toast, hydrated]
  );

  const clearCart = useCallback(() => {
    setLines([]);
    // Failed transfers must survive an account checkout and sign-out.
    if (!user) persistGuest([]);
  }, [persistGuest, user]);

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
