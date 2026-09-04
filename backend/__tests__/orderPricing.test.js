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
    // Product 1 is 4800 fils; 2 x 4800 = 9600, not the 1 the client asked for.
    expect(res.body.totalMinor).toBe(9600);
    expect(res.body.currency).toBe("AED");
  });

  it("returns an integer number of minor units, never a float", async () => {
    const res = await placeOrder({ items: [{ product_id: 1, quantity: 3 }] });

    expect(Number.isInteger(res.body.totalMinor)).toBe(true);
    expect(res.body.totalMinor).toBe(14400);
  });

  it("sums a multi-line order exactly", async () => {
    const res = await placeOrder({
      items: [
        { product_id: 1, quantity: 1 }, // 4800
        { product_id: 2, quantity: 2 }, // 8000
        { product_id: 3, quantity: 1 }, // 5600
      ],
    });

    expect(res.body.totalMinor).toBe(18400);
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
