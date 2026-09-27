import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CartLine } from "../cart";
import type { DashboardCart } from "../dashboard";
import { GUEST_CART_KEY, mergeGuestCart } from "../guestCart";

const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));
vi.mock("../dashboard", () => ({ dashboardGet: api.get, dashboardPatch: api.patch }));
const guest = (productId: string, quantity: number): CartLine => ({ id: productId, productId, quantity, name: "Cookie", description: "", priceMinor: 100, currency: "AED", image: "" });
const cart = (quantities: Record<string, number>): DashboardCart => ({ subtotal: "0.00", lines: Object.entries(quantities).map(([productId, quantity]) => ({ id: productId, productId, quantity, slug: null, name: "Cookie", image: null, price: "1.00", inStock: true })) });
const ok = (data: DashboardCart) => ({ ok: true, status: 200, data });
const failed = { ok: false, status: 0, error: { message: "Network error" } };

beforeEach(() => { localStorage.clear(); vi.resetAllMocks(); });

describe("guest cart transfer", () => {
  it("adds guest quantities to existing account items and transfers new items", async () => {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify([guest("a", 2), guest("b", 3)]));
    api.get.mockResolvedValue(ok(cart({ a: 4 })));
    api.patch.mockResolvedValueOnce(ok(cart({ a: 6 }))).mockResolvedValueOnce(ok(cart({ a: 6, b: 3 })));
    const result = await mergeGuestCart("customer", localStorage, () => true);
    expect(api.patch.mock.calls.map((call) => call[1])).toEqual([{ productId: "a", quantity: 6 }, { productId: "b", quantity: 3 }]);
    expect(result.lines).toHaveLength(2);
    expect(JSON.parse(localStorage.getItem(GUEST_CART_KEY)!)).toEqual([]);
  });

  it("retains a failed item and removes only acknowledged transfers", async () => {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify([guest("a", 2), guest("b", 3)]));
    api.get.mockResolvedValue(ok(cart({})));
    api.patch.mockResolvedValueOnce(ok(cart({ a: 2 }))).mockResolvedValueOnce(failed);
    await expect(mergeGuestCart("customer", localStorage, () => true)).rejects.toThrow("Network error");
    expect(JSON.parse(localStorage.getItem(GUEST_CART_KEY)!)).toEqual([guest("b", 3)]);
  });

  it("does not duplicate quantities when the server saved an item but its response was lost", async () => {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify([guest("a", 2)]));
    api.get.mockResolvedValueOnce(ok(cart({ a: 4 }))).mockResolvedValueOnce(ok(cart({ a: 6 })));
    api.patch.mockResolvedValue(failed);
    await expect(mergeGuestCart("customer", localStorage, () => true)).rejects.toThrow();
    await mergeGuestCart("customer", localStorage, () => true);
    expect(api.patch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem(GUEST_CART_KEY)!)).toEqual([]);
  });

  it("retries an unsuccessful write using its original absolute target", async () => {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify([guest("a", 2)]));
    api.get.mockResolvedValue(ok(cart({ a: 4 })));
    api.patch.mockResolvedValueOnce(failed).mockResolvedValueOnce(ok(cart({ a: 6 })));
    await expect(mergeGuestCart("customer", localStorage, () => true)).rejects.toThrow();
    await mergeGuestCart("customer", localStorage, () => true);
    expect(api.patch.mock.calls.map((call) => call[1].quantity)).toEqual([6, 6]);
  });

  it("shares an operation across effect replays and stops writes after account changes", async () => {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify([guest("a", 2)]));
    api.get.mockResolvedValue(ok(cart({})));
    const first = mergeGuestCart("customer", localStorage, () => false);
    expect(mergeGuestCart("customer", localStorage, () => false)).toBe(first);
    await first;
    expect(api.patch).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(GUEST_CART_KEY)!)).toHaveLength(1);
  });

  it("does not transfer an uncertain write to a different account", async () => {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify([guest("a", 2)]));
    api.get.mockResolvedValue(ok(cart({})));
    api.patch.mockResolvedValue(failed);
    await expect(mergeGuestCart("one", localStorage, () => true)).rejects.toThrow();
    await expect(mergeGuestCart("two", localStorage, () => true)).rejects.toThrow("previous account");
    expect(api.patch).toHaveBeenCalledTimes(1);
  });

  it("preserves extra guest quantities added between failed transfer attempts", async () => {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify([guest("a", 2)]));
    api.get.mockResolvedValueOnce(ok(cart({ a: 4 }))).mockResolvedValueOnce(ok(cart({ a: 6 })));
    api.patch.mockResolvedValueOnce(failed).mockResolvedValueOnce(ok(cart({ a: 7 })));
    await expect(mergeGuestCart("customer", localStorage, () => true)).rejects.toThrow();
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify([guest("a", 3)]));
    await mergeGuestCart("customer", localStorage, () => true);
    expect(api.patch.mock.calls.map((call) => call[1].quantity)).toEqual([6, 7]);
  });

  it("keeps quantities added while the transfer request is in flight", async () => {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify([guest("a", 2)]));
    api.get.mockResolvedValue(ok(cart({})));
    api.patch.mockImplementationOnce(async () => {
      localStorage.setItem(GUEST_CART_KEY, JSON.stringify([guest("a", 5)]));
      return ok(cart({ a: 2 }));
    });
    await mergeGuestCart("customer", localStorage, () => true);
    expect(JSON.parse(localStorage.getItem(GUEST_CART_KEY)!)).toEqual([guest("a", 3)]);
  });

  it("resolves the uncertain product before other lines after guest reordering", async () => {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify([guest("a", 2)]));
    api.get.mockResolvedValueOnce(ok(cart({}))).mockResolvedValueOnce(ok(cart({ a: 2 })));
    api.patch.mockResolvedValueOnce(failed).mockResolvedValueOnce(ok(cart({ a: 2, b: 1 })));
    await expect(mergeGuestCart("customer", localStorage, () => true)).rejects.toThrow();
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify([guest("b", 1), guest("a", 2)]));
    await mergeGuestCart("customer", localStorage, () => true);
    expect(api.patch.mock.calls.map((call) => call[1])).toEqual([{ productId: "a", quantity: 2 }, { productId: "b", quantity: 1 }]);
    expect(JSON.parse(localStorage.getItem(GUEST_CART_KEY)!)).toEqual([]);
  });

  it("does not overwrite an unconfirmed checkpoint when its guest line was removed", async () => {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify([guest("a", 2)]));
    api.get.mockResolvedValue(ok(cart({})));
    api.patch.mockResolvedValue(failed);
    await expect(mergeGuestCart("customer", localStorage, () => true)).rejects.toThrow();
    const checkpoint = localStorage.getItem("fluffy_cart_transfer");
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify([guest("b", 1)]));
    await expect(mergeGuestCart("customer", localStorage, () => true)).rejects.toThrow("could not be confirmed");
    expect(localStorage.getItem("fluffy_cart_transfer")).toBe(checkpoint);
    expect(api.patch).toHaveBeenCalledTimes(1);
  });
});
