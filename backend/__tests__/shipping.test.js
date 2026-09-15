/**
 * Delivery zones and shipping fees.
 *
 * The order recorded no delivery fee at all, so a delivered order's total did
 * not say what part of it was delivery — which matters for a refund and for any
 * revenue reporting.
 *
 * Rates are server-authoritative like every other amount: the client says where
 * it is going, never what that costs.
 */
const request = require("supertest");

const createApp = require("../app");
const { db } = require("../fileStore");
const {
  quoteShipping,
  findZone,
  amountToFreeDelivery,
  FREE_DELIVERY_THRESHOLD_MINOR,
} = require("../lib/shipping");

const app = createApp({ rateLimit: false });

const place = (contact, fulfillment = "Delivery", quantity = 1) =>
  request(app)
    .post("/api/v1/orders")
    .send({
      fulfillment,
      payment: "cash",
      contact: { name: "Test", phone: "0501234567", ...contact },
      items: [{ product_id: 1, quantity }],
    });

describe("resolving a zone", () => {
  it("matches an emirate regardless of case or padding", () => {
    expect(findZone("Al Ain").id).toBe("al-ain");
    expect(findZone("  al ain ").id).toBe("al-ain");
    expect(findZone("DUBAI").id).toBe("dubai-sharjah");
  });

  it("returns nothing for somewhere we do not deliver", () => {
    expect(findZone("Riyadh")).toBeNull();
    expect(findZone("")).toBeNull();
    expect(findZone(undefined)).toBeNull();
  });

  it("charges local less than far", () => {
    // Al Ain is where the bakery is; Fujairah is a different day's driving.
    const local = quoteShipping({
      fulfillment: "Delivery",
      emirate: "Al Ain",
      subtotalAfterDiscountMinor: 1000,
    });
    const far = quoteShipping({
      fulfillment: "Delivery",
      emirate: "Fujairah",
      subtotalAfterDiscountMinor: 1000,
    });
    expect(far.feeMinor).toBeGreaterThan(local.feeMinor);
  });
});

describe("quoting a fee", () => {
  it("charges nothing for pickup", () => {
    const q = quoteShipping({
      fulfillment: "Pickup",
      emirate: undefined,
      subtotalAfterDiscountMinor: 1000,
    });
    expect(q).toMatchObject({ ok: true, feeMinor: 0 });
  });

  it("refuses an area we do not serve rather than defaulting", () => {
    // Silently charging the local rate to drive somewhere far loses money on
    // every such order.
    const q = quoteShipping({
      fulfillment: "Delivery",
      emirate: "Riyadh",
      subtotalAfterDiscountMinor: 1000,
    });
    expect(q).toMatchObject({ ok: false, reason: "UNSUPPORTED_AREA" });
  });

  it("waives the fee above the threshold", () => {
    const q = quoteShipping({
      fulfillment: "Delivery",
      emirate: "Al Ain",
      subtotalAfterDiscountMinor: FREE_DELIVERY_THRESHOLD_MINOR,
    });
    expect(q).toMatchObject({ feeMinor: 0, freeDelivery: true });
  });

  it("still charges a fil below the threshold", () => {
    const q = quoteShipping({
      fulfillment: "Delivery",
      emirate: "Al Ain",
      subtotalAfterDiscountMinor: FREE_DELIVERY_THRESHOLD_MINOR - 1,
    });
    expect(q.feeMinor).toBeGreaterThan(0);
    expect(q.freeDelivery).toBe(false);
  });

  it("returns an integer fee", () => {
    const q = quoteShipping({
      fulfillment: "Delivery",
      emirate: "Dubai",
      subtotalAfterDiscountMinor: 1000,
    });
    expect(Number.isInteger(q.feeMinor)).toBe(true);
  });

  it("rejects a non-integer subtotal rather than pricing off a float", () => {
    expect(() =>
      quoteShipping({
        fulfillment: "Delivery",
        emirate: "Al Ain",
        subtotalAfterDiscountMinor: 100.5,
      })
    ).toThrow(TypeError);
  });
});

describe("amountToFreeDelivery", () => {
  it("says how much more to spend", () => {
    expect(amountToFreeDelivery(FREE_DELIVERY_THRESHOLD_MINOR - 500)).toBe(500);
  });

  it("is zero once the threshold is met", () => {
    expect(amountToFreeDelivery(FREE_DELIVERY_THRESHOLD_MINOR + 100)).toBe(0);
  });
});

describe("placing a delivery order", () => {
  it("adds the fee to the total and records it", async () => {
    // Product 1 is 4800; Al Ain delivery is 1500.
    const res = await place({ emirate: "Al Ain", area: "Zakher", address: "Villa 12" });

    expect(res.status).toBe(201);
    expect(res.body.shippingMinor).toBe(1500);
    expect(res.body.totalMinor).toBe(4800 + 1500);

    const order = db.orders.find((o) => o.orderNumber === res.body.orderNumber);
    expect(order.shipping_minor).toBe(1500);
    expect(order.shipping_zone).toBe("al-ain");
  });

  it("charges nothing for a pickup order", async () => {
    const res = await place({}, "Pickup");

    expect(res.body.shippingMinor).toBe(0);
    expect(res.body.totalMinor).toBe(4800);
  });

  it("refuses an area outside the zones", async () => {
    const res = await place({ emirate: "Riyadh", address: "Somewhere" });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/don't deliver/i);
  });

  it("refuses a delivery order with no emirate", async () => {
    // Better a clear refusal than guessing a zone and driving somewhere unpaid.
    const res = await place({ address: "Villa 12" });
    expect(res.status).toBe(400);
  });

  it("waives the fee on a large enough basket", async () => {
    // Four of product 1 is 19200, above the 15000 threshold.
    const res = await place({ emirate: "Al Ain" }, "Delivery", 4);

    expect(res.body.shippingMinor).toBe(0);
    expect(res.body.totalMinor).toBe(19200);
  });

  it("ignores a shipping fee posted by the client", async () => {
    // Same class of tampering as a posted price.
    const res = await request(app)
      .post("/api/v1/orders")
      .send({
        fulfillment: "Delivery",
        payment: "cash",
        contact: { name: "T", phone: "0501234567", emirate: "Fujairah" },
        items: [{ product_id: 1, quantity: 1 }],
        shipping_minor: 0,
        shippingMinor: 0,
      });

    // Fujairah is the most expensive zone; the client asking for 0 changes
    // nothing.
    expect(res.body.shippingMinor).toBe(4000);
  });
});

describe("GET /orders/shipping/zones", () => {
  it("publishes the zones and the threshold", async () => {
    const res = await request(app).get("/api/v1/orders/shipping/zones");

    expect(res.status).toBe(200);
    expect(res.body.freeDeliveryThresholdMinor).toBe(FREE_DELIVERY_THRESHOLD_MINOR);
    expect(res.body.zones.length).toBeGreaterThan(0);
    expect(res.body.zones[0]).toHaveProperty("emirates");
  });

  it("needs no authentication", async () => {
    const res = await request(app).get("/api/v1/orders/shipping/zones");
    expect(res.status).toBe(200);
  });
});
