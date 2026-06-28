"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { StatusState } from "@/components/ui/StatusState";
import { OrderCard } from "@/components/order/OrderCard";
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
          <label className="flex flex-1 flex-col gap-1 text-small text-navy/80">
            Order number
            <input
              className="fluffy-field"
              placeholder="e.g. FL12345"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
            />
          </label>
          <Button type="submit" disabled={state === "loading"}>
            {state === "loading" ? "Tracking…" : "Track"}
          </Button>
        </form>

        <div className="mx-auto mt-10 max-w-md">
          {state === "loading" && (
            <StatusState variant="loading" title="Looking up your order…" />
          )}
          {state === "notfound" && (
            <StatusState
              variant="error"
              title="Order not found"
              message="Double-check the reference number and try again."
            />
          )}
          {state === "found" && order && <OrderCard order={order} />}
        </div>
      </Container>
    </main>
  );
}
