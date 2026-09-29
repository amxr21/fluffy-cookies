import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { parseOrderReceipt } from "@/lib/orderReceipt";
import { OrderReceiptDetails } from "@/components/order/OrderReference";

vi.mock("next/navigation", () => ({ useSearchParams: vi.fn() }));

describe("order success receipt", () => {
  it("shows the returned total and delivery instructions", () => {
    const receipt = parseOrderReceipt(new URLSearchParams("order=ORD-1045-ABC123&fulfillment=DELIVERY&totalMinor=6300"));
    render(<OrderReceiptDetails receipt={receipt} />);
    expect(screen.getByText("#ORD-1045-ABC123")).toBeInTheDocument();
    expect(screen.getByText(/prepare your order for delivery/)).toBeInTheDocument();
    expect(screen.getByText(/AED\s*63\.00/)).toBeInTheDocument();
    expect(screen.queryByText(/collecting|pickup/i)).not.toBeInTheDocument();
  });

  it("shows collection instructions for pickup", () => {
    render(<OrderReceiptDetails receipt={parseOrderReceipt(new URLSearchParams("order=ORD-1&fulfillment=PICKUP&totalMinor=0"))} />);
    expect(screen.getByText(/when collecting/)).toBeInTheDocument();
    expect(screen.getByText(/AED\s*0\.00/)).toBeInTheDocument();
  });

  it.each(["-1", "1.5", "NaN", "Infinity", "9007199254740992"])("ignores malformed receipt totals %s", (total) => {
    expect(parseOrderReceipt(new URLSearchParams({ totalMinor: total })).totalMinor).toBeNull();
  });

  it("supports old links without inventing totals or a fulfillment method", () => {
    expect(parseOrderReceipt(new URLSearchParams("order=ORD-1"))).toEqual({ reference: "ORD-1", fulfillment: null, totalMinor: null });
  });
});
