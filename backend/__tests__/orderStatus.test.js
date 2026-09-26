/**
 * Order state machine — the standard's fifth high-risk path.
 *
 * `status` was a mutable string that only ever held "pending", so the tracker
 * already shipped on the storefront could never advance. What must now hold:
 * legal moves work, illegal ones are refused rather than silently written, and
 * every move leaves an append-only record of who did it.
 */
const request = require("supertest");

const createApp = require("../app");
const { db } = require("../fileStore");
const { ACCESS_COOKIE, signAccessToken } = require("../lib/tokens");
const {
  STATUS,
  allowedNext,
  canTransition,
  isTerminal,
  assertTransition,
} = require("../lib/orderStatus");

const app = createApp({ rateLimit: false });

const ADMIN_ID = 801;
const CUSTOMER_ID = 802;

function token(id, role) {
  if (!db.users.find((u) => u.id === id)) {
    db.users.push({ id, email: `${id}@example.test`, role, name: "T", token_version: 0 });
  } else {
    db.users.find((u) => u.id === id).role = role;
  }
  return signAccessToken({ id, email: `${id}@example.test`, role, tokenVersion: 0 });
}

const adminToken = () => token(ADMIN_ID, "admin");
const customerToken = () => token(CUSTOMER_ID, "customer");

/** Place a real order and return its public number. */
async function placeOrder() {
  const res = await request(app)
    .post("/api/v1/orders")
    .send({
      fulfillment: "Pickup",
      payment: "cash",
      contact: { name: "Test", phone: "0501234567" },
      items: [{ product_id: 1, quantity: 1 }],
    });
  return res.body.orderNumber;
}

const setStatus = (orderNumber, status, tok, note) =>
  request(app)
    .patch(`/api/v1/admin/orders/${orderNumber}/status`)
    .set("Cookie", `${ACCESS_COOKIE}=${tok}`)
    .send({ status, ...(note ? { note } : {}) });

describe("the transition table", () => {
  it("starts every order at pending", async () => {
    const n = await placeOrder();
    const order = db.orders.find((o) => o.orderNumber === n);
    expect(order.status).toBe(STATUS.PENDING);
  });

  it("allows the happy path forward", () => {
    expect(canTransition(STATUS.PENDING, STATUS.PREPARING)).toBe(true);
    expect(canTransition(STATUS.PREPARING, STATUS.READY)).toBe(true);
    expect(canTransition(STATUS.READY, STATUS.COMPLETED)).toBe(true);
  });

  it("refuses to move backwards", () => {
    expect(canTransition(STATUS.READY, STATUS.PENDING)).toBe(false);
    expect(canTransition(STATUS.COMPLETED, STATUS.READY)).toBe(false);
  });

  it("refuses to skip a step", () => {
    expect(canTransition(STATUS.PENDING, STATUS.READY)).toBe(false);
    expect(canTransition(STATUS.PENDING, STATUS.COMPLETED)).toBe(false);
  });

  it("allows cancelling up to hand-off, but not after", () => {
    // The food still exists until it is collected; after that there is nothing
    // to cancel.
    expect(canTransition(STATUS.PENDING, STATUS.CANCELLED)).toBe(true);
    expect(canTransition(STATUS.PREPARING, STATUS.CANCELLED)).toBe(true);
    expect(canTransition(STATUS.READY, STATUS.CANCELLED)).toBe(true);
    expect(canTransition(STATUS.COMPLETED, STATUS.CANCELLED)).toBe(false);
  });

  it("treats completed and cancelled as terminal", () => {
    expect(isTerminal(STATUS.COMPLETED)).toBe(true);
    expect(isTerminal(STATUS.CANCELLED)).toBe(true);
    expect(isTerminal(STATUS.PENDING)).toBe(false);
  });

  it("names the legal moves, so a UI can say what IS possible", () => {
    expect(allowedNext(STATUS.PENDING)).toEqual([STATUS.PREPARING, STATUS.CANCELLED]);
    expect(allowedNext(STATUS.COMPLETED)).toEqual([]);
  });
});

describe("assertTransition", () => {
  it("distinguishes an unknown status from an illegal move", () => {
    // Different failures mean different things to whoever hits them.
    expect(() => assertTransition(STATUS.PENDING, "shipped-to-mars")).toThrow(
      /Unknown order status/
    );
    expect(() => assertTransition(STATUS.PENDING, STATUS.COMPLETED)).toThrow(
      /Cannot move an order from pending to completed/
    );
  });

  it("names what IS allowed in the error", () => {
    expect(() => assertTransition(STATUS.PENDING, STATUS.COMPLETED)).toThrow(
      /Allowed from pending: preparing, cancelled/
    );
  });

  it("treats a no-op as a conflict, not a failure to fix", () => {
    // A double-clicked button, not an operator error.
    expect(() => assertTransition(STATUS.READY, STATUS.READY)).toThrow(
      /already ready/
    );
  });

  it("says an order is finished rather than listing no moves", () => {
    expect(() => assertTransition(STATUS.COMPLETED, STATUS.PREPARING)).toThrow(
      /is completed and cannot change state/
    );
  });
});

describe("PATCH /admin/orders/:n/status", () => {
  it("advances an order and reports what comes next", async () => {
    const n = await placeOrder();
    const res = await setStatus(n, STATUS.PREPARING, adminToken());

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      orderNumber: n,
      status: STATUS.PREPARING,
      previousStatus: STATUS.PENDING,
    });
    expect(res.body.allowedNext).toEqual([STATUS.READY, STATUS.CANCELLED]);
  });

  it("walks the whole happy path", async () => {
    const n = await placeOrder();
    const tok = adminToken();

    for (const next of [STATUS.PREPARING, STATUS.READY, STATUS.COMPLETED]) {
      const res = await setStatus(n, next, tok);
      expect(res.status).toBe(200);
    }

    expect(db.orders.find((o) => o.orderNumber === n).status).toBe(STATUS.COMPLETED);
  });

  it("refuses an illegal jump and leaves the order untouched", async () => {
    const n = await placeOrder();
    const res = await setStatus(n, STATUS.COMPLETED, adminToken());

    expect(res.status).toBe(409);
    // The decisive part: the refusal did not half-apply.
    expect(db.orders.find((o) => o.orderNumber === n).status).toBe(STATUS.PENDING);
  });

  it("rejects a status that is not in the vocabulary", async () => {
    const n = await placeOrder();
    const res = await setStatus(n, "refunded-maybe", adminToken());

    expect(res.status).toBe(400);
  });

  it("404s an unknown order", async () => {
    const res = await setStatus("FLZZZZZZZZ", STATUS.PREPARING, adminToken());
    expect(res.status).toBe(404);
  });
});

describe("who may move an order", () => {
  it("refuses a customer", async () => {
    const n = await placeOrder();
    const res = await setStatus(n, STATUS.PREPARING, customerToken());

    expect(res.status).toBe(403);
    expect(db.orders.find((o) => o.orderNumber === n).status).toBe(STATUS.PENDING);
  });

  it("refuses an anonymous caller", async () => {
    const n = await placeOrder();
    const res = await request(app)
      .patch(`/api/v1/admin/orders/${n}/status`)
      .send({ status: STATUS.PREPARING });

    expect(res.status).toBe(401);
  });

  it("refuses a demoted admin immediately", async () => {
    // The point of re-checking the role against the store rather than trusting
    // the token: access ends at demotion, not at token expiry.
    const n = await placeOrder();
    const tok = adminToken();

    db.users.find((u) => u.id === ADMIN_ID).role = "customer";
    try {
      const res = await setStatus(n, STATUS.PREPARING, tok);
      expect(res.status).toBe(403);
    } finally {
      db.users.find((u) => u.id === ADMIN_ID).role = "admin";
    }
  });
});

describe("the history", () => {
  it("records placement, so history starts at creation", async () => {
    const n = await placeOrder();
    const order = db.orders.find((o) => o.orderNumber === n);
    const events = db.order_events.filter((e) => e.order_id === order.id);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ from_status: null, to_status: STATUS.PENDING });
  });

  it("records who moved it and from what", async () => {
    const n = await placeOrder();
    await setStatus(n, STATUS.PREPARING, adminToken(), "started baking");

    const order = db.orders.find((o) => o.orderNumber === n);
    const last = db.order_events.filter((e) => e.order_id === order.id).at(-1);

    expect(last).toMatchObject({
      from_status: STATUS.PENDING,
      to_status: STATUS.PREPARING,
      actor_id: ADMIN_ID,
      note: "started baking",
    });
  });

  it("writes nothing when a transition is refused", async () => {
    const n = await placeOrder();
    const order = db.orders.find((o) => o.orderNumber === n);
    const before = db.order_events.filter((e) => e.order_id === order.id).length;

    await setStatus(n, STATUS.COMPLETED, adminToken());

    const after = db.order_events.filter((e) => e.order_id === order.id).length;
    expect(after).toBe(before);
  });

  it("is exposed on the admin order view", async () => {
    const n = await placeOrder();
    const tok = adminToken();
    await setStatus(n, STATUS.PREPARING, tok);

    const res = await request(app)
      .get(`/api/v1/admin/orders/${n}`)
      .set("Cookie", `${ACCESS_COOKIE}=${tok}`);

    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(2);
    expect(res.body.allowedNext).toEqual([STATUS.READY, STATUS.CANCELLED]);
    // The operator view keeps the contact details the public one strips.
    expect(res.body.contact).toBeDefined();
  });
});

describe("the customer-facing view", () => {
  it("reflects the new status on the public tracker", async () => {
    // The whole point: the storefront tracker can finally move.
    const n = await placeOrder();
    await setStatus(n, STATUS.PREPARING, adminToken());

    const res = await request(app).get(`/api/v1/orders/track/${n}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(STATUS.PREPARING);
    // Still no PII on the public route.
    expect(res.body.contact).toBeUndefined();
  });

  it("uses vocabulary the shipped tracker already maps", async () => {
    // frontend/lib/orders.ts maps these exact strings onto its four phases; a
    // mismatch would render an empty tracker rather than an error.
    const uiPhases = ["pending", "preparing", "ready", "completed"];
    for (const phase of uiPhases) {
      expect(Object.values(STATUS)).toContain(phase);
    }
  });
});
