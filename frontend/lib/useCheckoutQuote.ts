"use client";

import { useEffect, useState } from "react";
import { dashboardPost } from "@/lib/dashboard";
import { readCheckoutQuote, type CheckoutQuote } from "@/lib/checkoutQuote";
import type { CartLine } from "@/lib/cart";

export function useCheckoutQuote(lines: CartLine[], discountCode: string, customerId?: string, fulfillment = "Pickup", deliveryZoneId = "") {
  const [revision, setRevision] = useState(0);
  const key = JSON.stringify({ items: lines.map(line => ({ productId: String(line.productId), quantity: line.quantity })), discountCode, customerId, fulfillment, deliveryZoneId, revision });
  const [result, setResult] = useState<{ key: string; quote: CheckoutQuote | null; error: string | null } | null>(null);
  useEffect(() => {
    const snapshot = JSON.parse(key) as { items: { productId: string; quantity: number }[]; discountCode: string; fulfillment: string; deliveryZoneId: string };
    if (!snapshot.items.length || (snapshot.fulfillment === "Delivery" && !snapshot.deliveryZoneId)) return;
    let active = true;
    const timeout = setTimeout(() => {
      void (async () => {
        try {
          const response = await dashboardPost<CheckoutQuote>("/orders/quote", {
            items: snapshot.items,
            fulfillment: snapshot.fulfillment,
            ...(snapshot.fulfillment === "Delivery" ? { deliveryZoneId: snapshot.deliveryZoneId } : {}),
            ...(snapshot.discountCode ? { discountCode: snapshot.discountCode } : {}),
          });
          if (!active) return;
          if (!response.ok) setResult({ key, quote: null, error: response.error.message });
          else setResult({ key, quote: readCheckoutQuote(response.data), error: null });
        } catch {
          if (active) setResult({ key, quote: null, error: "Couldn't load current prices. Please try again." });
        }
      })();
    }, 200);
    return () => { active = false; clearTimeout(timeout); };
  }, [key]);
  // A changed cart/account/code invalidates the old quote immediately, before
  // the effect runs. Slow responses cannot put stale prices back on screen.
  const current = result?.key === key ? result : null;
  return { quote: current?.quote ?? null, error: current?.error ?? null, loading: lines.length > 0 && current === null, refresh: () => setRevision(value => value + 1) };
}
