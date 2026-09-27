/** Order shapes returned by the backend (to be connected later). */

export type OrderItem = {
  product_id: string;
  /** Name as charged, snapshotted on the order line — not the live product
   *  name, so a later rename cannot rewrite a past invoice. */
  name_snapshot: string;
  quantity: number;
  /** Unit price as charged, in minor units. */
  unit_price_minor: number;
  currency: string;
};

export type Order = {
  orderNumber: string;
  status: string;
  totalMinor: number;
  currency: string;
  createdAt: string;
  fulfillment: string;
  items: OrderItem[];
};

/* ------------------------------------------------------------------ */
/*  Order progress phases                                              */
/* ------------------------------------------------------------------ */

/** The phases an order moves through, in order. `getOrderProgress` maps the
 *  dashboard's order statuses onto them. */
export const ORDER_PHASES = [
  {
    id: "pending",
    label: "Order placed",
    description: "We've received your order and sent it to the kitchen.",
    /** Kirby art shown while this phase is the current one. */
    art: "/images/kirby/order-placed.svg",
  },
  {
    id: "preparing",
    label: "Preparing",
    description: "Your cookies are being baked and your drinks pulled fresh.",
    art: "/images/kirby/preparing.svg",
  },
  {
    id: "ready",
    label: "Ready",
    description: "Everything's boxed up and waiting for you.",
    art: "/images/kirby/ready.svg",
  },
  {
    id: "completed",
    label: "Completed",
    description: "Your order is complete. Thanks for choosing Fluffy!",
    art: "/images/kirby/completed.svg",
  },
] as const;

export type OrderPhaseId = (typeof ORDER_PHASES)[number]["id"];

/** Statuses that end the order without completing it. */
const CANCELLED = new Set(["cancelled", "canceled", "refunded", "failed"]);

/** Backend statuses that mean the same thing as one of our phases. Keeps the
 *  UI resilient to naming differences rather than silently showing no progress. */
const ALIASES: Record<string, OrderPhaseId> = {
  pending: "pending",
  placed: "pending",
  new: "pending",
  confirmed: "preparing",
  preparing: "preparing",
  baking: "preparing",
  in_progress: "preparing",
  processing: "preparing",
  ready: "ready",
  ready_for_pickup: "ready",
  out_for_delivery: "ready",
  shipped: "ready",
  completed: "completed",
  complete: "completed",
  delivered: "completed",
  collected: "completed",
  picked_up: "completed",
  fulfilled: "completed",
};

export type OrderProgress = {
  /** Index into ORDER_PHASES, or -1 when the order is cancelled. */
  currentIndex: number;
  cancelled: boolean;
  returned: boolean;
};

/** Fulfillment changes the handover wording, never the order's status. */
export function getOrderPhases(fulfillment?: string) {
  const type = fulfillment?.toUpperCase();
  return ORDER_PHASES.map((phase) => {
    if (phase.id === "ready" && type === "DELIVERY") return { ...phase, label: "Out for delivery", description: "Your order is on its way to you." };
    if (phase.id === "ready" && type === "PICKUP") return { ...phase, label: "Ready for pickup", description: "Your order is ready to collect at the branch." };
    if (phase.id === "completed" && type === "DELIVERY") return { ...phase, label: "Delivered", description: "Your order has been delivered. Thanks for choosing Fluffy!" };
    if (phase.id === "completed" && type === "PICKUP") return { ...phase, label: "Collected", description: "You've collected your order. Thanks for choosing Fluffy!" };
    return phase;
  });
}

/** Map a raw backend status onto the phase timeline. Unknown statuses fall
 *  back to the first phase so the tracker always renders something sensible. */
export function getOrderProgress(status: string): OrderProgress {
  const key = String(status || "").trim().toLowerCase().replace(/[\s-]+/g, "_");

  if (key === "returned") return { currentIndex: -1, cancelled: false, returned: true };
  if (CANCELLED.has(key)) return { currentIndex: -1, cancelled: true, returned: false };

  const phase = ALIASES[key];
  const idx = phase ? ORDER_PHASES.findIndex((p) => p.id === phase) : 0;
  return { currentIndex: idx < 0 ? 0 : idx, cancelled: false, returned: false };
}
