import { decimalToMinor } from "@/lib/dashboard";

export type CheckoutQuote = {
  lines: { productId: string; variantId: string | null; name: string; quantity: number; price: string; lineTotal: string }[];
  subtotal: string;
  discountCode: string | null;
  discountAmount: string;
  taxAmount: string;
  total: string;
  pricesIncludeTax: boolean;
};

/** Reject incomplete upstream pricing rather than silently displaying zero. */
export function readCheckoutQuote(value: CheckoutQuote): CheckoutQuote {
  if (!value || !Array.isArray(value.lines) || typeof value.pricesIncludeTax !== "boolean"
    || (value.discountCode !== null && typeof value.discountCode !== "string")) throw new Error("Invalid pricing response");
  for (const amount of [value.subtotal, value.discountAmount, value.taxAmount, value.total]) decimalToMinor(amount);
  for (const line of value.lines) {
    if (typeof line.productId !== "string" || typeof line.name !== "string" || !Number.isSafeInteger(line.quantity) || line.quantity < 1) throw new Error("Invalid pricing line");
    decimalToMinor(line.price);
    decimalToMinor(line.lineTotal);
  }
  return value;
}
