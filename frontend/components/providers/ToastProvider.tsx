"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { FiX } from "react-icons/fi";

import { cn } from "@/lib/utils";

/**
 * Themed toast system — the universal mutation-feedback channel (per the
 * storefront template). Usage:
 *   const toast = useToast();
 *   toast.success("Added to cart", { action: { label: "Cart", href: "/cart" } });
 */

type Variant = "success" | "error" | "info";

type ToastAction = { label: string; href: string };

type ToastInput = {
  title?: string;
  action?: ToastAction;
  duration?: number;
};

type Toast = ToastInput & {
  id: number;
  message: string;
  variant: Variant;
};

type ToastApi = {
  success: (message: string, opts?: ToastInput) => void;
  error: (message: string, opts?: ToastInput) => void;
  info: (message: string, opts?: ToastInput) => void;
};

const ToastContext = createContext<ToastApi>({
  success: () => {},
  error: () => {},
  info: () => {},
});

let idCounter = 0;

const VARIANT_BAR: Record<Variant, string> = {
  success: "bg-navy",
  error: "bg-brown",
  info: "bg-navy/60",
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  const [entered, setEntered] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const r = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(r);
  }, []);

  const dismiss = useCallback(() => {
    setLeaving(true);
    setTimeout(() => onDismiss(toast.id), 350);
  }, [onDismiss, toast.id]);

  useEffect(() => {
    const t = setTimeout(dismiss, toast.duration ?? 4000);
    return () => clearTimeout(t);
  }, [dismiss, toast.duration]);

  return (
    <div
      role={toast.variant === "error" ? "alert" : "status"}
      aria-live={toast.variant === "error" ? "assertive" : "polite"}
      className={cn(
        "pointer-events-auto flex w-80 max-w-[90vw] overflow-hidden rounded-xl border border-navy/10 bg-white shadow-xl shadow-navy/10 transition-all duration-350 ease-out",
        entered && !leaving
          ? "translate-x-0 opacity-100"
          : "translate-x-6 opacity-0"
      )}
    >
      <span className={cn("w-1.5 shrink-0", VARIANT_BAR[toast.variant])} />
      <div className="flex-1 px-4 py-3">
        {toast.title && (
          <p className="text-small font-bold text-navy">{toast.title}</p>
        )}
        <p className="text-small text-navy/80">{toast.message}</p>
        {toast.action && (
          <Link
            href={toast.action.href}
            onClick={dismiss}
            className="mt-1 inline-block text-caption font-semibold text-navy underline underline-offset-2"
          >
            {toast.action.label}
          </Link>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss notification"
        className="grid shrink-0 place-items-center self-start p-3 text-navy/40 transition-colors hover:text-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
      >
        <FiX aria-hidden className="size-4" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (variant: Variant, message: string, opts?: ToastInput) => {
      const id = ++idCounter;
      setToasts((prev) => [...prev, { id, variant, message, ...opts }]);
    },
    []
  );

  const api: ToastApi = {
    success: (m, o) => push("success", m, o),
    error: (m, o) => push("error", m, o),
    info: (m, o) => push("info", m, o),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Right edge and stacking match the navbar (fixed inset-x-4 / md:inset-x-16,
          top-4 / md:top-6) so toasts line up with it instead of jutting past.
          z sits just above the navbar's z-50. */}
      <div className="pointer-events-none fixed right-4 top-24 z-60 flex flex-col items-end gap-3 md:right-16 md:top-28">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
