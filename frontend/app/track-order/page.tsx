"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Input } from "@/components/ui/Field";
import { StatusState } from "@/components/ui/StatusState";
import { OrderCard } from "@/components/order/OrderCard";
import { OrderProgress } from "@/components/order/OrderProgress";
import { getJSON } from "@/lib/safeFetch";
import type { Order } from "@/lib/orders";

export default function TrackOrderPage() {
  const [number, setNumber] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "notfound" | "found">(
    "idle"
  );

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    const ref = number.trim();
    if (!ref) return;
    setState("loading");
    const res = await getJSON<Order>(`/orders/track/${encodeURIComponent(ref)}`);
    if (res.ok && res.data) {
      setOrder(res.data);
      setState("found");
    } else {
      setOrder(null);
      setState("notfound");
    }
  };

  return (
    <main className="flex-1">
      <Container className="py-16 md:py-24">
        <h1 className="mb-2 text-center text-h2 uppercase text-navy">
          Track Your Order
        </h1>
        <p className="mb-8 text-center text-body text-navy/70">
          Enter your order reference number — no account needed.
        </p>

        <form
          onSubmit={handleTrack}
          className="mx-auto flex max-w-md flex-wrap items-end gap-3"
        >
          <Input
            label="Order number"
            required
            className="flex-1"
            placeholder="e.g. FL3K92MTQ7"
            autoCapitalize="characters"
            hint="Starts with FL — it's on your confirmation email and receipt."
            error={state === "notfound" ? "We couldn't find that order." : undefined}
            value={number}
            onChange={(e) => setNumber(e.target.value)}
          />
          <Button type="submit" disabled={state === "loading"}>
            {state === "loading" ? "Tracking…" : "Track"}
          </Button>
        </form>

        {/* Widen once a result is in — the 4-phase timeline is cramped at max-w-md. */}
        <div
          className={
            state === "found"
              ? "mx-auto mt-10 max-w-2xl"
              : "mx-auto mt-10 max-w-md"
          }
        >
          {state === "loading" && (
            <StatusState variant="loading" title="Looking up your order…" />
          )}
          {state === "found" && order && (
            <div className="space-y-6">
              <OrderProgress status={order.status} />
              <OrderCard order={order} />
            </div>
          )}
        </div>
      </Container>
    </main>
  );
}
