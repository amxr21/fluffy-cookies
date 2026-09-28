export type OrderReceipt = {
  reference: string | null;
  fulfillment: "PICKUP" | "DELIVERY" | null;
  totalMinor: number | null;
};

/** Receipt hints are display-only; tracking and order history remain server-backed. */
export function parseOrderReceipt(query: { get(name: string): string | null }): OrderReceipt {
  const reference = query.get("order");
  const fulfillment = query.get("fulfillment");
  const total = query.get("totalMinor");
  const totalMinor = total !== null && /^\d{1,15}$/.test(total) ? Number(total) : null;
  return {
    reference: reference && /^[a-zA-Z0-9-]{1,100}$/.test(reference) ? reference : null,
    fulfillment: fulfillment === "PICKUP" || fulfillment === "DELIVERY" ? fulfillment : null,
    totalMinor: totalMinor !== null && Number.isSafeInteger(totalMinor) ? totalMinor : null,
  };
}
