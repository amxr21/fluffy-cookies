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
import { dashboardGet, dashboardPost, type DashboardProduct } from "@/lib/dashboard";

/**
 * Wishlist state.
 *
 * The dashboard's wishlist toggles on `POST /wishlist`; `/liked` reads it.
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
      const res = await dashboardGet<DashboardProduct[]>("/wishlist");
      if (!active) return;
      if (res.ok) setLikedIds(new Set(res.data.map((product) => product.id)));
      else toast.error(res.error.message);
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

      const res = await dashboardPost<{ liked: boolean }>("/wishlist", { productId: key });

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
