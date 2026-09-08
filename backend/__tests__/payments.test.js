/**
 * Payments, webhooks and refunds.
 *
 * B7's three rules, and the two attacks from B10.9 that target them:
 *
 *   #6  Replay a payment webhook, and forge one with a bad signature
 *   #12 (adjacent) Refund more than was paid
 *
 * The stub adapter mirrors the real signature scheme, so these exercise the
 * actual verification path rather than a bypass.
 */
const request = require("supertest");

const createApp = require("../app");
const { db } = require("../fileStore");
const stub = require("../payments/stub");
const { ACCESS_COOKIE, signAccessToken } = require("../lib/tokens");

const app = createApp({ rateLimit: false });

const ADMIN_ID = 201;

function adminToken() {
  if (!db.users.find((u) => u.id === ADMIN_ID)) {
    db.users.push({ id: ADMIN_ID, email: "pay@example.test", role: "admin", token_version: 0 });
  }
  return signAccessToken({
    id: ADMIN_ID,
    email: "pay@example.test",
    role: "admin",
    tokenVersion: 0,
  });
}

/** Place an order and start a payment for it. */
async function orderWithIntent() {
  const placed = await request(app)
    .post("/api/v1/orders")
    .send({
      fulfillment: "Pickup",
      payment: "cash",
      contact: { name: "Test", phone: "0501234567" },
      items: [{ product_id: 1, quantity: 1 }],
    });

  const intent = await request(app)
    .post("/api/v1/payments/intent")
    .send({ orderNumber: placed.body.orderNumber });

  return { orderNumber: placed.body.orderNumber, ...intent.body, status: intent.status };
}

/**
 * Post a correctly signed webhook, as the provider would.
 *
 * The payload is sent as a STRING, not a Buffer. supertest JSON-serialises a
 * Buffer into {"type":"Buffer","data":[...]}, so the server would hash entirely
 * different bytes than were signed — which looks exactly like a forged
 * signature and is a trap worth naming.
 */
function sendWebhook(event, { signature } = {}) {
  const payload = JSON.stringify(event);
  return request(app)
    .post("/api/v1/payments/webhook")
    .set("Content-Type", "application/json")
    .set("stripe-signature", signature ?? stub.signPayload(payload))
    .send(payload);
}

const succeededEvent = (providerRef, amount, id = `evt_${Math.random().toString(36).slice(2)}`) => ({
  id,
  type: "payment_intent.succeeded",
  data: { object: { id: providerRef, amount, amount_received: amount } },
});

describe("creating a payment intent", () => {
  it("returns a client secret and records a pending payment", async () => {
    const { providerRef, clientSecret, amountMinor, status } = await orderWithIntent();

    expect(status).toBe(201);
    expect(clientSecret).toBeTruthy();
    // Product 1 is 4800 fils.
    expect(amountMinor).toBe(4800);

    const payment = db.payments.find((p) => p.provider_ref === providerRef);
    expect(payment.status).toBe("pending");
  });

  it("prices from the order, not from the request", async () => {
    // The whole point of B6 would be lost if the browser could name the charge.
    const placed = await request(app)
      .post("/api/v1/orders")
      .send({
        fulfillment: "Pickup",
        payment: "cash",
        contact: { name: "T", phone: "0501234567" },
        items: [{ product_id: 1, quantity: 2 }],
      });

    const res = await request(app)
      .post("/api/v1/payments/intent")
      .send({ orderNumber: placed.body.orderNumber, amountMinor: 1, totalMinor: 1 });

    expect(res.body.amountMinor).toBe(9600);
  });

  it("404s an unknown order", async () => {
    const res = await request(app)
      .post("/api/v1/payments/intent")
      .send({ orderNumber: "FLZZZZZZZZ" });
    expect(res.status).toBe(404);
  });

  it("refuses to start a second payment for a paid order", async () => {
    const { orderNumber, providerRef, amountMinor } = await orderWithIntent();
    await sendWebhook(succeededEvent(providerRef, amountMinor));

    const again = await request(app)
      .post("/api/v1/payments/intent")
      .send({ orderNumber });

    expect(again.status).toBe(409);
  });
});

describe("webhook signature", () => {
  it("accepts a correctly signed event", async () => {
    const { providerRef, amountMinor } = await orderWithIntent();
    const res = await sendWebhook(succeededEvent(providerRef, amountMinor));

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it("rejects a forged signature", async () => {
    // Attack #6. Anyone on the internet can reach this endpoint.
    const { providerRef, amountMinor } = await orderWithIntent();
    const res = await sendWebhook(succeededEvent(providerRef, amountMinor), {
      signature: "t=9999999999,v1=deadbeef",
    });

    expect(res.status).toBe(400);
  });

  it("rejects a missing signature", async () => {
    const { providerRef, amountMinor } = await orderWithIntent();
    const res = await sendWebhook(succeededEvent(providerRef, amountMinor), {
      signature: "",
    });
    expect(res.status).toBe(400);
  });

  it("rejects a replayed request from outside the tolerance window", async () => {
    // A genuine signature captured last week must not still work.
    const { providerRef, amountMinor } = await orderWithIntent();
    const payload = JSON.stringify(succeededEvent(providerRef, amountMinor));
    const old = Math.floor(Date.now() / 1000) - 86400;
    const crypto = require("crypto");
    const v1 = crypto
      .createHmac("sha256", "stub-webhook-secret")
      .update(`${old}.${payload}`, "utf8")
      .digest("hex");

    const res = await request(app)
      .post("/api/v1/payments/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", `t=${old},v1=${v1}`)
      .send(payload);

    expect(res.status).toBe(400);
  });

  it("rejects a body altered after signing", async () => {
    const { providerRef, amountMinor } = await orderWithIntent();
    const original = JSON.stringify(succeededEvent(providerRef, amountMinor));
    const signature = stub.signPayload(original);

    // Same signature, bigger amount.
    const tampered = original.replace(String(amountMinor), "1");

    const res = await request(app)
      .post("/api/v1/payments/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", signature)
      .send(tampered);

    expect(res.status).toBe(400);
  });
});

describe("webhook idempotency", () => {
  it("marks an order paid exactly once for a duplicated event", async () => {
    // Attack #6, and the launch-gate line: "a duplicated webhook produces
    // exactly one payment record".
    const { orderNumber, providerRef, amountMinor } = await orderWithIntent();
    const event = succeededEvent(providerRef, amountMinor, "evt_duplicate_test");

    const first = await sendWebhook(event);
    const second = await sendWebhook(event);

    expect(first.body.duplicate).toBeUndefined();
    expect(second.body.duplicate).toBe(true);

    expect(db.webhook_events.filter((e) => e.event_id === "evt_duplicate_test")).toHaveLength(1);

    const order = db.orders.find((o) => o.orderNumber === orderNumber);
    expect(order.payment_status).toBe("paid");
  });

  it("answers 200 to a duplicate, so the provider stops retrying", async () => {
    const { providerRef, amountMinor } = await orderWithIntent();
    const event = succeededEvent(providerRef, amountMinor, "evt_retry_test");

    await sendWebhook(event);
    const second = await sendWebhook(event);

    expect(second.status).toBe(200);
  });
});

describe("amount verification", () => {
  it("refuses to mark an order paid for the wrong amount", async () => {
    // A webhook says what the provider charged; whether that matches what we
    // asked for is our job to check.
    const { orderNumber, providerRef } = await orderWithIntent();

    const res = await sendWebhook(succeededEvent(providerRef, 1));

    expect(res.status).toBe(200); // acknowledged, so no retry storm
    expect(res.body.mismatch).toBe(true);

    const order = db.orders.find((o) => o.orderNumber === orderNumber);
    expect(order.payment_status).not.toBe("paid");
  });

  it("acknowledges an event for a payment it does not know", async () => {
    const res = await sendWebhook(succeededEvent("pi_never_seen", 100));

    expect(res.status).toBe(200);
    expect(res.body.matched).toBe(false);
  });
});

describe("refunds", () => {
  async function paidOrder() {
    const { orderNumber, providerRef, amountMinor } = await orderWithIntent();
    await sendWebhook(succeededEvent(providerRef, amountMinor));
    return { orderNumber, amountMinor };
  }

  const refund = (orderNumber, body, token) =>
    request(app)
      .post(`/api/v1/admin/orders/${orderNumber}/refund`)
      .set("Cookie", `${ACCESS_COOKIE}=${token ?? adminToken()}`)
      .send(body);

  it("refunds the full amount by default", async () => {
    const { orderNumber, amountMinor } = await paidOrder();

    const res = await refund(orderNumber, {});

    expect(res.status).toBe(201);
    expect(res.body.amountMinor).toBe(amountMinor);
    expect(res.body.remainingMinor).toBe(0);
  });

  it("supports a partial refund and tracks what remains", async () => {
    const { orderNumber, amountMinor } = await paidOrder();

    const res = await refund(orderNumber, { amountMinor: 1000 });

    expect(res.body.amountMinor).toBe(1000);
    expect(res.body.remainingMinor).toBe(amountMinor - 1000);
  });

  it("cannot refund more than was paid", async () => {
    const { orderNumber, amountMinor } = await paidOrder();

    const res = await refund(orderNumber, { amountMinor: amountMinor + 1 });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/more than remains/i);
  });

  it("cannot refund twice past the total", async () => {
    // Refund abuse: two partial refunds that together exceed the payment.
    const { orderNumber, amountMinor } = await paidOrder();

    await refund(orderNumber, { amountMinor: amountMinor - 100 });
    const second = await refund(orderNumber, { amountMinor: 500 });

    expect(second.status).toBe(400);
  });

  it("refuses a refund on an unpaid order", async () => {
    const { orderNumber } = await orderWithIntent();

    const res = await refund(orderNumber, {});

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/no completed payment/i);
  });

  it("refuses a customer", async () => {
    const { orderNumber } = await paidOrder();
    const customer = signAccessToken({
      id: 202,
      email: "c@example.test",
      role: "customer",
      tokenVersion: 0,
    });
    if (!db.users.find((u) => u.id === 202)) {
      db.users.push({ id: 202, email: "c@example.test", role: "customer", token_version: 0 });
    }

    const res = await refund(orderNumber, {}, customer);
    expect(res.status).toBe(403);
  });

  it("records who issued it", async () => {
    const { orderNumber } = await paidOrder();
    await refund(orderNumber, { amountMinor: 500 });

    expect(db.refunds.at(-1).actor_id).toBe(ADMIN_ID);
  });
});
