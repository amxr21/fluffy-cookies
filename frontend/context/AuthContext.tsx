"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { AUTH_KEYS } from "@/lib/config";
import { postJSON } from "@/lib/safeFetch";

/**
 * Lazy auth session (per storefront template). The session lives in
 * localStorage; this context exposes it reactively and provides login/logout.
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
  login: (user: AuthUser) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAuthenticated: false,
  login: () => {},
  logout: async () => {},
});

function readSession(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const userId = localStorage.getItem(AUTH_KEYS.userId);
  const name = localStorage.getItem(AUTH_KEYS.userName);
  if (!userId) return null;
  return {
    userId,
    name: name ?? "",
    picture: localStorage.getItem(AUTH_KEYS.userPicture) ?? "",
    role: localStorage.getItem(AUTH_KEYS.userRole) ?? "customer",
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(readSession());
  }, []);

  const login = useCallback((next: AuthUser) => {
    localStorage.setItem(AUTH_KEYS.userId, next.userId);
    localStorage.setItem(AUTH_KEYS.userName, next.name);
    localStorage.setItem(AUTH_KEYS.userPicture, next.picture);
    localStorage.setItem(AUTH_KEYS.userRole, next.role);
    setUser(next);
  }, []);

  const logout = useCallback(async () => {
    // Server first: the cookies are httpOnly, so only the API can clear them,
    // and the session row must be revoked or a captured token stays valid.
    await postJSON("/auth/logout", {});
    Object.values(AUTH_KEYS).forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem("fluffy_cart");
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, isAuthenticated: !!user, login, logout }),
    [user, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
