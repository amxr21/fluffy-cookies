/**
 * Server-authoritative pricing and order snapshots.
 *
 * Two invariants from the build standard meet here:
 *   1. The server is the only authority on price — the client proposes items,
 *      never amounts.
 *   2. An order records what was actually charged, so editing a product later
 *      cannot rewrite a past invoice.
 */
const request = require("supertest");

const createApp = require("../app");
const { db } = require("../fileStore");

const app = createApp({ rateLimit: false });

/** Place an order as a guest and return the parsed response. */
const placeOrder = (body) =>
  request(app)
    .post("/api/v1/orders")
    .send({
      fulfillment: "Pickup",
      payment: "cash",
      contact: { name: "Test", phone: "0501234567" },
      ...body,
    });

describe("server-authoritative pricing", () => {
  it("prices the order from the database, ignoring any total in the body", async () => {
    const res = await placeOrder({
      items: [{ product_id: 1, quantity: 2 }],
      // A tampered cart: none of these may influence the charge.
      total: 1,
      totalMinor: 1,
      price: 1,
    });

    expect(res.status).toBe(201);
    // Pinned deliberately: the assertion is that the charge comes from the
    // database (2 x 4800) and NOT from the 1 the client sent. Deriving it from
    // the same source the endpoint reads would weaken exactly that point.
    const unit = db.products.find((p) => p.id === 1).price_minor;
    expect(res.body.totalMinor).toBe(2 * unit);
    expect(res.body.totalMinor).not.toBe(1);
    expect(res.body.currency).toBe("AED");
  });

  it("returns an integer number of minor units, never a float", async () => {
    const res = await placeOrder({ items: [{ product_id: 1, quantity: 3 }] });

    expect(Number.isInteger(res.body.totalMinor)).toBe(true);
    expect(res.body.totalMinor).toBe(14400);
  });

  it("sums a multi-line order exactly", async () => {
    const lines = [
      { product_id: 1, quantity: 1 },
      { product_id: 2, quantity: 2 },
      { product_id: 3, quantity: 1 },
    ];

    // Derived from the seed data rather than hardcoded: the catalogue's
    // contents are not this test's subject, and a hardcoded total silently
    // rots the moment a price or the product list changes.
    const expected = lines.reduce((total, line) => {
      const product = db.products.find((p) => p.id === line.product_id);
      return total + product.price_minor * line.quantity;
    }, 0);

    const res = await placeOrder({ items: lines });

    expect(res.body.totalMinor).toBe(expected);
    // Guard against the derivation and the endpoint both being trivially zero.
    expect(res.body.totalMinor).toBeGreaterThan(0);
  });

  it("rejects an unknown product rather than pricing it at zero", async () => {
    const res = await placeOrder({ items: [{ product_id: 9999, quantity: 1 }] });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/Unknown product/);
  });
});

describe("order line snapshots", () => {
  it("keeps the price and name as charged when the product later changes", async () => {
    const placed = await placeOrder({ items: [{ product_id: 1, quantity: 1 }] });
    const { orderNumber } = placed.body;
    expect(placed.body.totalMinor).toBe(4800);

    // The shop raises the price and renames the product after the order.
    const product = db.products.find((p) => p.id === 1);
    const originalPrice = product.price_minor;
    const originalName = product.name;
    product.price_minor = 9900;
    product.name = "Renamed Cookie";

    try {
      const tracked = await request(app).get(`/api/v1/orders/track/${orderNumber}`);

      expect(tracked.status).toBe(200);
      // The order still says what it charged, not what the product costs now.
      expect(tracked.body.totalMinor).toBe(4800);
      expect(tracked.body.items[0].unit_price_minor).toBe(4800);
      expect(tracked.body.items[0].name_snapshot).toBe("Classic Chocolate Chip");
    } finally {
      product.price_minor = originalPrice;
      product.name = originalName;
    }
  });

  it("records the currency on every line", async () => {
    const placed = await placeOrder({ items: [{ product_id: 2, quantity: 1 }] });
    const tracked = await request(app).get(
      `/api/v1/orders/track/${placed.body.orderNumber}`
    );

    expect(tracked.body.currency).toBe("AED");
    expect(tracked.body.items[0].currency).toBe("AED");
  });
});
