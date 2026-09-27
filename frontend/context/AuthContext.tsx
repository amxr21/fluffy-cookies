"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { dashboardGet, dashboardPost, type DashboardCustomer } from "@/lib/dashboard";

/**
 * Lazy auth session. The session itself is an httpOnly cookie that only the
 * /api/storefront bridge can read; this context asks the dashboard who that
 * cookie belongs to (`/me`) and exposes the answer reactively.
 * Stateful actions (addToCart, etc.) gate on `userId` and prompt sign-in.
 */

/** Display data only. The session itself lives in httpOnly cookies the server
 *  reads — nothing here is trusted for authorisation. */
export type AuthUser = {
  userId: string;
  name: string;
  picture: string;
  role: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  hydrated: boolean;
  login: (user: AuthUser) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAuthenticated: false,
  hydrated: false,
  login: () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    void dashboardGet<DashboardCustomer>("/me").then((result) => {
      if (!active) return;
      if (result.ok) setUser({ userId: result.data.id, name: result.data.name, picture: result.data.picture ?? "", role: "customer" });
      setHydrated(true);
    });
    return () => { active = false; };
  }, []);

  const login = useCallback((next: AuthUser) => {
    setUser(next);
  }, []);

  const logout = useCallback(async () => {
    // The cookie is httpOnly, so only the bridge can clear it.
    const result = await dashboardPost<{ success: boolean }>("/auth/logout", {});
    if (!result.ok) throw new Error(result.error.message);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, isAuthenticated: !!user, hydrated, login, logout }),
    [user, hydrated, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
