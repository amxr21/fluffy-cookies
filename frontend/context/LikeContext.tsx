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
import { useAuth } from "@/context/AuthContext";
import { getJSON, postJSON, type Paginated } from "@/lib/safeFetch";
import { DASHBOARD_MODE } from "@/lib/config";
import { dashboardGet, dashboardPost, type DashboardProduct } from "@/lib/dashboard";

/**
 * Wishlist state.
 *
 * `POST /likes` has always existed and `/liked` has always read the list — but
 * nothing in the UI could ever write one, so the page was empty by
 * construction. This is the missing half.
 *
 * Optimistic, with rollback: a heart that waits for a round trip feels broken,
 * and one that lies when the request fails is worse. The standard permits
 * optimistic UI "only where rollback is implemented".
 */

type LikeContextValue = {
  likedIds: Set<string>;
  isLiked: (productId: string | number) => boolean;
  toggleLike: (productId: string | number) => Promise<void>;
  hydrated: boolean;
};

const LikeContext = createContext<LikeContextValue>({
  likedIds: new Set(),
  isLiked: () => false,
  toggleLike: async () => {},
  hydrated: false,
});

type LikedProduct = { id?: number | string; productId?: number };

export function LikeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const toast = useToast();
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!user) {
      // Signing out must clear the hearts, not leave the previous user's.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLikedIds(new Set());
      setHydrated(true);
      return;
    }

    let active = true;
    (async () => {
      if (DASHBOARD_MODE) {
        const res = await dashboardGet<DashboardProduct[]>("/wishlist");
        if (!active) return;
        if (res.ok) setLikedIds(new Set(res.data.map((product) => product.id)));
        else toast.error(res.error.message);
        setHydrated(true);
        return;
      }
      const res = await getJSON<Paginated<LikedProduct>>(
        `/likes/${user.userId}?limit=100`
      );
      if (!active) return;

      if (res.ok && Array.isArray(res.data?.data)) {
        setLikedIds(
          new Set(
            res.data.data
              .map((p) => String(p.productId ?? p.id))
              .filter((id) => id !== "undefined")
          )
        );
      }
      setHydrated(true);
    })();

    return () => {
      active = false;
    };
  }, [user, toast]);

  const isLiked = useCallback((productId: string | number) => likedIds.has(String(productId)), [likedIds]);

  const toggleLike = useCallback(
    async (productId: string | number) => {
      // Lazy auth: gate on the action, not with a login wall.
      if (!user) {
        toast.info("Sign in to save your favourites");
        return;
      }

      const key = String(productId);
      const wasLiked = likedIds.has(key);

      // Optimistic.
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (wasLiked) next.delete(key);
        else next.add(key);
        return next;
      });

      const res = DASHBOARD_MODE
        ? await dashboardPost<{ liked: boolean }>("/wishlist", { productId: key })
        : await postJSON("/likes", { product_id: productId });

      if (!res.ok) {
        // Roll back to exactly what it was, rather than toggling again — a
        // second toggle would race another click and land on the wrong value.
        setLikedIds((prev) => {
          const next = new Set(prev);
          if (wasLiked) next.add(key);
          else next.delete(key);
          return next;
        });
        toast.error(res.error.message || "Couldn't update your favourites");
      }
    },
    [likedIds, toast, user]
  );

  const value = useMemo(
    () => ({ likedIds, isLiked, toggleLike, hydrated }),
    [likedIds, isLiked, toggleLike, hydrated]
  );

  return <LikeContext.Provider value={value}>{children}</LikeContext.Provider>;
}

export const useLikes = () => useContext(LikeContext);
