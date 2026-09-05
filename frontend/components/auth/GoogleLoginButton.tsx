"use client";

import Image from "next/image";
import Link from "next/link";
import { FiX } from "react-icons/fi";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/providers/ToastProvider";
import { GOOGLE_CLIENT_ID } from "@/lib/config";
import { postJSON } from "@/lib/safeFetch";
import { reportClientError } from "@/lib/clientLogger";
import { cn } from "@/lib/utils";
import { isAllowedAvatarHost } from "@/lib/avatarHost";

type AuthResponse = {
  success: boolean;
  token: string;
  name: string;
  picture?: string;
  userId: string;
  role?: string;
};

// minimal shape of the Google Identity Services global
type GsiId = {
  initialize: (cfg: { client_id: string; callback: (r: { credential?: string }) => void }) => void;
  renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
};
declare global {
  interface Window {
    google?: { accounts?: { id?: GsiId } };
  }
}

export function GoogleLoginButton() {
  const { user, login, logout } = useAuth();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // close account menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const handleCredential = async (response: { credential?: string }) => {
    const result = await postJSON<AuthResponse>("/auth", {
      id_token: response?.credential,
    });
    if (!result.ok || !result.data?.success) {
      reportClientError({
        source: "google-signin",
        message: `Auth failed: ${result.ok ? "no success" : result.error.message}`,
        component: "GoogleLoginButton",
      });
      toast.error("Sign-in failed. Please try again.");
      return;
    }
    const d = result.data;
    login({
      token: d.token,
      userId: d.userId,
      name: d.name,
      picture: d.picture ?? "",
      role: d.role ?? "customer",
    });
    toast.success(`Welcome${d.name ? `, ${d.name.split(" ")[0]}` : ""}!`);
    setSignInOpen(false);
    setTimeout(() => window.location.reload(), 400);
  };

  // render Google's official button inside the modal
  useEffect(() => {
    if (user || !signInOpen) return;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tryInit = () => {
      const gsi = window.google?.accounts?.id;
      if (gsi) {
        try {
          gsi.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleCredential,
          });
          const el = document.getElementById("googleSignIn");
          if (el) {
            el.innerHTML = "";
            gsi.renderButton(el, {
              theme: "outline",
              size: "large",
              shape: "pill",
              width: 280,
            });
          }
        } catch (err) {
          reportClientError({
            source: "google-signin",
            message: `GSI init failed: ${err instanceof Error ? err.message : ""}`,
            component: "GoogleLoginButton",
          });
        }
        return;
      }
      if (attempts++ < 25) timer = setTimeout(tryInit, 200);
    };
    tryInit();
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signInOpen, user]);

  const handleLogout = () => {
    logout();
    toast.success("Signed out");
    setMenuOpen(false);
    setTimeout(() => (window.location.href = "/"), 300);
  };

  if (user) {
    const first = user.name ? user.name.split(" ")[0] : "Account";
    // Two different failures, both ending at the same fallback initial:
    //   isAllowedAvatarHost — next/image THROWS on a host missing from
    //     next.config's remotePatterns, and that error unmounts the whole page.
    //     This has to be caught before render, not after.
    //   avatarFailed — the host is fine but the image did not load (an expired
    //     Google URL, a network blip). Reported by onError, after render.
    const hasPic =
      user.picture.trim().length > 0 &&
      isAllowedAvatarHost(user.picture) &&
      !avatarFailed;
    return (
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="group flex items-center gap-2"
        >
          <span className="relative grid size-9 place-items-center overflow-hidden rounded-xl bg-navy/10 text-small font-bold text-navy ring-2 ring-transparent transition-all group-hover:ring-navy/30">
            {hasPic ? (
              <Image
                fill
                src={user.picture}
                alt=""
                sizes="36px"
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
                className="object-cover"
              />
            ) : (
              first.charAt(0).toUpperCase()
            )}
          </span>
        </button>

        <div
          role="menu"
          className={cn(
            "absolute right-0 mt-2 w-52 origin-top-right overflow-hidden rounded-xl border border-navy/10 bg-white shadow-xl shadow-navy/10 transition-all duration-200",
            menuOpen
              ? "scale-100 opacity-100"
              : "pointer-events-none scale-95 opacity-0"
          )}
        >
          <div className="border-b border-navy/10 px-4 py-3">
            <p className="text-caption text-navy/60">Signed in as</p>
            <p className="truncate font-semibold text-navy">{user.name}</p>
          </div>
          <nav className="flex flex-col py-1 text-small">
            <Link href="/my-orders" onClick={() => setMenuOpen(false)} className="px-4 py-2 text-navy/80 transition-colors hover:bg-navy/5">My orders</Link>
            <Link href="/liked" onClick={() => setMenuOpen(false)} className="px-4 py-2 text-navy/80 transition-colors hover:bg-navy/5">Liked items</Link>
            <Link href="/cart" onClick={() => setMenuOpen(false)} className="px-4 py-2 text-navy/80 transition-colors hover:bg-navy/5">My cart</Link>
            <Link href="/track-order" onClick={() => setMenuOpen(false)} className="px-4 py-2 text-navy/80 transition-colors hover:bg-navy/5">Track an order</Link>
          </nav>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full border-t border-navy/10 px-4 py-3 text-left font-semibold text-navy transition-colors hover:bg-navy/5"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setSignInOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-small font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-95"
      >
        Sign in
      </button>

      <div
        className={cn(
          "fixed inset-0 z-[1000001] flex items-center justify-center p-4 transition-all duration-300",
          signInOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        <div
          className={cn(
            "absolute inset-0 bg-black/40 transition-all duration-300",
            signInOpen ? "backdrop-blur-md" : "backdrop-blur-none"
          )}
          onClick={() => setSignInOpen(false)}
        />
        <div
          role="dialog"
          aria-modal="true"
          className={cn(
            "relative flex w-full max-w-sm flex-col items-center gap-5 rounded-2xl bg-white p-8 text-center shadow-2xl transition-all duration-300",
            signInOpen ? "translate-y-0 scale-100" : "translate-y-2 scale-95"
          )}
        >
          <button
            type="button"
            onClick={() => setSignInOpen(false)}
            aria-label="Close sign-in dialog"
            className="absolute right-3 top-3 grid place-items-center rounded-lg p-1.5 text-navy/40 transition-colors hover:bg-navy/5 hover:text-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
          >
            <FiX aria-hidden className="size-4" />
          </button>
          <h2 className="text-h3 font-bold text-navy">Welcome to Fluffy</h2>
          <p className="-mt-2 text-small text-navy/70">
            Sign in to save your cart, liked items, and track orders.
          </p>
          <div
            id="googleSignIn"
            className="flex min-h-[44px] justify-center overflow-hidden rounded-full"
          />
          <p className="text-caption text-navy/40">
            We only use your Google account to identify you.
          </p>
        </div>
      </div>
    </>
  );
}
