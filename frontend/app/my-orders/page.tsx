"use client";

import { useEffect, useState } from "react";

import { Container } from "@/components/ui/Container";
import { StatusState } from "@/components/ui/StatusState";
import { SkeletonGroup, SkeletonRow } from "@/components/ui/Skeleton";
import { OrderCard } from "@/components/order/OrderCard";
import { useAuth } from "@/context/AuthContext";
import type { Order } from "@/lib/orders";
import { dashboardGet, dashboardOrderToOrder, type DashboardOrder } from "@/lib/dashboard";

export default function MyOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [state, setState] = useState<
    "loading" | "ready" | "error"
  >("loading");

  useEffect(() => {
    // Signed out renders the sign-in prompt before `state` is read.
    if (!user) return;
    let active = true;
    (async () => {
      const res = await dashboardGet<DashboardOrder[]>("/orders");
      if (!active) return;
      if (res.ok) {
        try { setOrders(res.data.map(dashboardOrderToOrder)); setState("ready"); }
        catch { setState("error"); }
      } else setState("error");
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
          <SkeletonGroup label="Loading your orders" className="space-y-4">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </SkeletonGroup>
        ) : state === "error" ? (
          <StatusState
            variant="error"
            title="Couldn't load your orders"
            message="Please try again in a moment."
            cta={{ label: "Reload", href: "/my-orders" }}
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
