"use client";

import { useEffect, useState } from "react";

import { Container } from "@/components/ui/Container";
import { StatusState } from "@/components/ui/StatusState";
import { OrderCard } from "@/components/order/OrderCard";
import { useAuth } from "@/context/AuthContext";
import { getJSON } from "@/lib/safeFetch";
import type { Order } from "@/lib/orders";

export default function MyOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!user) {
      setState("ready");
      return;
    }
    let active = true;
    (async () => {
      const res = await getJSON<Order[]>(`/orders/user/${user.userId}`);
      if (!active) return;
      if (res.ok && Array.isArray(res.data)) {
        setOrders(res.data);
        setState("ready");
      } else {
        setState("error");
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  return (
    <main className="flex-1">
      <Container className="py-16 md:py-24">
        <h1 className="mb-8 text-center text-h2 uppercase text-navy">My Orders</h1>

        {!user ? (
          <StatusState
            variant="empty"
            title="Sign in to see your orders"
            message="Your order history appears here once you're signed in."
            cta={{ label: "Track an order instead", href: "/track-order" }}
          />
        ) : state === "loading" ? (
          <StatusState variant="loading" title="Loading your orders…" />
        ) : state === "error" ? (
          <StatusState
            variant="error"
            title="Couldn't load your orders"
            message="Please try again in a moment."
          />
        ) : orders.length === 0 ? (
          <StatusState
            variant="empty"
            title="No orders yet"
            message="When you place an order, it'll show up here."
            cta={{ label: "Browse the Menu", href: "/menu" }}
          />
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {orders.map((o) => (
              <OrderCard key={o.orderNumber} order={o} />
            ))}
          </div>
        )}
      </Container>
    </main>
  );
}
