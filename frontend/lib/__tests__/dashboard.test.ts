import { describe, expect, it } from "vitest";
import {
  dashboardCartToLines,
  dashboardMenuToCategories,
  dashboardOrderToOrder,
  decimalToMinor,
} from "../dashboard";

describe("dashboard public contract adapter", () => {
  it("converts fixed-decimal prices into integer fils exactly", () => {
    expect(decimalToMinor("48.05")).toBe(4805);
    expect(decimalToMinor("0.01")).toBe(1);
    expect(() => decimalToMinor("48.005")).toThrow();
  });

  it("keeps dashboard string IDs when mapping sellable products and cart lines", () => {
    const [category] = dashboardMenuToCategories([{
      id: "category-id", title: "Cookies", slug: "cookies", items: [{
        id: "cuid-product", slug: "chocolate-cookie", name: "Chocolate Cookie",
        description: null, price: "48.00", image: null, stock: 2, inStock: true,
        category: { id: "category-id", name: "Cookies", slug: "cookies" },
      }],
    }]);
    expect(category.items[0]).toMatchObject({ productId: "cuid-product", id: "chocolate-cookie", priceMinor: 4800 });
    const [line] = dashboardCartToLines({ subtotal: "96.00", lines: [{
      id: "cart-id", productId: "cuid-product", slug: "chocolate-cookie",
      name: "Chocolate Cookie", image: null, price: "48.00", quantity: 2, inStock: true,
    }] });
    expect(line).toMatchObject({ productId: "cuid-product", priceMinor: 4800, quantity: 2 });
  });

  it("maps dashboard order history to the existing order card", () => {
    const order = dashboardOrderToOrder({
      orderNumber: "FL-123", status: "PENDING", total: "50.40",
      placedAt: "2026-09-14T00:00:00.000Z",
      items: [{ name: "Cookie", quantity: 1, price: "48.00" }],
    });
    expect(order.totalMinor).toBe(5040);
    expect(order.items[0].unit_price_minor).toBe(4800);
  });
});
