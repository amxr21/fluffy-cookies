"use client";

import { useSearchParams } from "next/navigation";
import { formatMinor } from "@/lib/money";
import { parseOrderReceipt, type OrderReceipt } from "@/lib/orderReceipt";

/** Reads the order reference from the URL (?order=…) on the success page. */
export function OrderReference() {
  const receipt = parseOrderReceipt(useSearchParams());
  return <OrderReceiptDetails receipt={receipt} />;
}

export function OrderReceiptDetails({ receipt }: { receipt: OrderReceipt }) {
  const instruction = receipt.fulfillment === "PICKUP"
    ? "Please show your reference number when collecting your order."
    : receipt.fulfillment === "DELIVERY"
      ? "We’ll prepare your order for delivery. Keep your reference number to track its progress."
      : "Keep your reference number to track your order’s progress.";
  return (
    <>
      {receipt.reference ? (
        <p className="break-words text-h3 text-navy">
          Your Reference Number: <span className="font-bold">#{receipt.reference}</span>
        </p>
      ) : <p className="text-body text-navy/70">Your order has been placed successfully.</p>}
      <p className="mt-2 text-body text-navy/70">{instruction}</p>
      {receipt.totalMinor !== null && (
        <p className="mt-4 text-h3 text-navy">Order total: <span className="font-bold">{formatMinor(receipt.totalMinor)}</span></p>
      )}
    </>
  );
}
