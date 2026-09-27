import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCheckoutQuote } from "@/lib/useCheckoutQuote";
import type { CartLine } from "@/lib/cart";
import type { CheckoutQuote } from "@/lib/checkoutQuote";

const post = vi.hoisted(() => vi.fn());
vi.mock("@/lib/dashboard", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/dashboard")>(), dashboardPost: post }));
const line: CartLine = { id: "cookie", productId: "p1", name: "Cookie", description: "", image: "", currency: "AED", priceMinor: 4800, quantity: 1 };
const quote: CheckoutQuote = { lines: [{ productId: "p1", variantId: null, name: "Cookie", quantity: 1, price: "48.00", lineTotal: "48.00" }], subtotal: "48.00", discountCode: null, discountAmount: "0.00", taxAmount: "2.29", total: "48.00", pricesIncludeTax: true };
const success = { ok: true, status: 200, data: quote };
beforeEach(() => { vi.useFakeTimers(); post.mockReset(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
const tick = () => act(async () => { await vi.advanceTimersByTimeAsync(210); });

describe("current checkout quote", () => {
  it("sends codes for validation and discards prices immediately when the cart changes", async () => {
    post.mockResolvedValue(success);
    const { result, rerender } = renderHook(({ quantity }) => useCheckoutQuote([{ ...line, quantity }], "SAVE", "c1"), { initialProps: { quantity: 1 } });
    await tick();
    expect(post).toHaveBeenCalledWith("/orders/quote", { items: [{ productId: "p1", quantity: 1 }], discountCode: "SAVE" });
    expect(result.current.quote?.total).toBe("48.00");
    rerender({ quantity: 2 });
    expect(result.current.quote).toBeNull();
    expect(result.current.loading).toBe(true);
  });
  it("ignores a late response from a previous shopper account", async () => {
    let finish!: (value: typeof success) => void;
    post.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const { result, rerender } = renderHook(({ customer }) => useCheckoutQuote([line], "", customer), { initialProps: { customer: "c1" } });
    await tick();
    rerender({ customer: "c2" });
    await act(async () => { finish(success); });
    expect(result.current.quote).toBeNull();
    post.mockResolvedValue(success);
    await tick();
    expect(result.current.quote?.total).toBe("48.00");
  });
  it("keeps failed pricing unavailable and allows a retry", async () => {
    post.mockResolvedValueOnce({ ok: false, status: 400, error: { message: "Code cannot be applied" } }).mockResolvedValueOnce(success);
    const { result } = renderHook(() => useCheckoutQuote([line], "SAVE"));
    await tick();
    expect(result.current.quote).toBeNull();
    expect(result.current.error).toBe("Code cannot be applied");
    act(() => result.current.refresh());
    await tick();
    expect(result.current.quote?.total).toBe("48.00");
  });
});
