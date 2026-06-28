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

/**
 * Lazy auth session (per storefront template). The session lives in
 * localStorage; this context exposes it reactively and provides login/logout.
 * Stateful actions (addToCart, etc.) gate on `userId` and prompt sign-in.
 */

export type AuthUser = {
  userId: string;
  name: string;
  picture: string;
  role: string;
  token: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (user: AuthUser) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
});

function readSession(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem(AUTH_KEYS.token);
  const userId = localStorage.getItem(AUTH_KEYS.userId);
  const name = localStorage.getItem(AUTH_KEYS.userName);
  if (!token || !userId) return null;
  return {
    token,
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
    localStorage.setItem(AUTH_KEYS.token, next.token);
    localStorage.setItem(AUTH_KEYS.userId, next.userId);
    localStorage.setItem(AUTH_KEYS.userName, next.name);
    localStorage.setItem(AUTH_KEYS.userPicture, next.picture);
    localStorage.setItem(AUTH_KEYS.userRole, next.role);
    setUser(next);
  }, []);

  const logout = useCallback(() => {
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
