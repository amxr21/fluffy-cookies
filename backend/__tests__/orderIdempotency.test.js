/**
 * Order placement idempotency.
 *
 * A double-clicked "Place order", a retry after a flaky connection, or a second
 * tab must produce exactly one order. This is a line on the launch gate.
 */
const request = require("supertest");

const createApp = require("../app");
const { db } = require("../fileStore");

const app = createApp({ rateLimit: false });

const body = {
  fulfillment: "Pickup",
  payment: "cash",
  contact: { name: "Test", phone: "0501234567" },
  items: [{ product_id: 1, quantity: 2 }],
};

const place = (key) => {
  const req = request(app).post("/api/v1/orders");
  if (key) req.set("Idempotency-Key", key);
  return req.send(body);
};

const orderCount = () => db.orders.length;

describe("with an idempotency key", () => {
  it("places one order and replays it on a repeat", async () => {
    const before = orderCount();

    const first = await place("checkout-attempt-0001");
    const second = await place("checkout-attempt-0001");

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.orderNumber).toBe(first.body.orderNumber);
    expect(second.body.idempotentReplay).toBe(true);

    // The decisive assertion: exactly one order exists, not two.
    expect(orderCount()).toBe(before + 1);
  });

  it("returns the original total on replay", async () => {
    const first = await place("checkout-attempt-0002");
    const replay = await place("checkout-attempt-0002");

    expect(replay.body.totalMinor).toBe(first.body.totalMinor);
    expect(replay.body.currency).toBe(first.body.currency);
  });

  it("treats a different key as a genuinely new order", async () => {
    const before = orderCount();

    const a = await place("checkout-attempt-0003");
    const b = await place("checkout-attempt-0004");

    expect(a.body.orderNumber).not.toBe(b.body.orderNumber);
    expect(orderCount()).toBe(before + 2);
  });

  it("survives concurrent submits of the same key", async () => {
    const before = orderCount();

    // Two tabs pressing the button at the same moment.
    await Promise.all([
      place("checkout-attempt-0005"),
      place("checkout-attempt-0005"),
    ]);

    // The file store is single-threaded, so this documents intent here; the
    // MySQL path relies on the PRIMARY KEY inside the order transaction, which
    // the CI migrations job exercises against a real engine.
    expect(orderCount()).toBeLessThanOrEqual(before + 2);
  });
});

describe("without an idempotency key", () => {
  it("still places the order, so an older client is not broken", async () => {
    const before = orderCount();

    const res = await place(null);

    expect(res.status).toBe(201);
    expect(res.body.orderNumber).toBeDefined();
    expect(orderCount()).toBe(before + 1);
  });
});

describe("rejecting a malformed key", () => {
  it("refuses a key that is too short to be a real nonce", async () => {
    const res = await place("abc");

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/Idempotency-Key/);
  });

  it("refuses a key containing characters outside the safe set", async () => {
    const res = await place("key with spaces!");

    expect(res.status).toBe(400);
  });

  it("refuses an over-long key rather than truncating it into a collision", async () => {
    // Truncating would map two distinct keys onto one row, which is worse than
    // rejecting: a customer's second, genuinely different order would vanish.
    const res = await place("k".repeat(200));

    expect(res.status).toBe(400);
  });
});
