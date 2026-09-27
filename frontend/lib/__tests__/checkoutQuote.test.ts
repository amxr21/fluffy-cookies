import { describe, expect, it } from "vitest";
import { readCheckoutQuote, type CheckoutQuote } from "@/lib/checkoutQuote";

const quote: CheckoutQuote = {
  lines: [{ productId: "p1", variantId: null, name: "Cookie", quantity: 1, price: "48.00", lineTotal: "48.00" }],
  subtotal: "48.00", discountCode: null, discountAmount: "0.00", taxAmount: "2.29", total: "48.00", pricesIncludeTax: true,
};

describe("checkout pricing response", () => {
  it("keeps inclusive VAT inside the server total", () => {
    expect(readCheckoutQuote(quote).total).toBe("48.00");
    expect(readCheckoutQuote(quote).pricesIncludeTax).toBe(true);
  });
  it("refuses invalid money before enabling checkout", () => {
    expect(() => readCheckoutQuote({ ...quote, total: "NaN" })).toThrow();
    expect(() => readCheckoutQuote({ ...quote, taxAmount: "-2.29" })).toThrow();
    expect(() => readCheckoutQuote({ ...quote, lines: [{ ...quote.lines[0], quantity: 0 }] })).toThrow();
  });
});
