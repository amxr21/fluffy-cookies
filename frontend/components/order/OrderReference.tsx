"use client";

import { useSearchParams } from "next/navigation";

/** Reads the order reference from the URL (?order=…) on the success page. */
export function OrderReference() {
  const ref = useSearchParams().get("order");
  if (!ref) {
    return (
      <p className="text-body text-navy/70">
        Your order has been placed successfully.
      </p>
    );
  }
  return (
    <>
      <p className="text-h3 text-navy">
        Your Reference Number: <span className="font-bold">#{ref}</span>
      </p>
      <p className="mt-1 text-body text-navy/70">(Please show this at pickup)</p>
    </>
  );
}
