/**
 * Stock reservation and oversell protection.
 *
 * The standard's fourth high-risk path. Before this, every product was
 * infinitely orderable — for a bakery working from daily batches that means
 * taking fifty orders for twenty cookies and finding out at collection time.
 *
 * The invariant: `reserved` never exceeds `on_hand`, no matter the order of
 * concurrent placements.
 */
const request = require("supertest");

const createApp = require("../app");
const { db } = require("../fileStore");
const { ACCESS_COOKIE, signAccessToken } = require("../lib/tokens");
const { STATUS } = require("../lib/orderStatus");

const app = createApp({ rateLimit: false });

const ADMIN_ID = 701;
const PRODUCT = 1;

function adminToken() {
  if (!db.users.find((u) => u.id === ADMIN_ID)) {
    db.users.push({
      id: ADMIN_ID,
      email: "stock-admin@example.test",
      role: "admin",
      name: "Stock Admin",
      token_version: 0,
    });
  }
  return signAccessToken({
    id: ADMIN_ID,
    email: "stock-admin@example.test",
    role: "admin",
    tokenVersion: 0,
  });
}

/** Put a product's inventory into a known state. */
function setStock(productId, { onHand, reserved = 0, trackStock = 1 }) {
  const existing = db.inventory.find((r) => r.product_id === productId);
  const row = {
    product_id: productId,
    on_hand: onHand,
    reserved,
    low_stock_threshold: 5,
    track_stock: trackStock,
  };
  if (existing) Object.assign(existing, row);
  else db.inventory.push(row);
  return row;
}

const stockOf = (productId) => db.inventory.find((r) => r.product_id === productId);

const order = (productId, quantity) =>
  request(app)
    .post("/api/v1/orders")
    .send({
      fulfillment: "Pickup",
      payment: "cash",
      contact: { name: "Test", phone: "0501234567" },
      items: [{ product_id: productId, quantity }],
    });

afterEach(() => {
  db.inventory = [];
  db.inventory_ledger = [];
});

describe("reserving stock at placement", () => {
  it("reserves what the order takes", async () => {
    setStock(PRODUCT, { onHand: 10 });

    const res = await order(PRODUCT, 3);

    expect(res.status).toBe(201);
    expect(stockOf(PRODUCT).reserved).toBe(3);
    // on_hand does not move until the goods physically leave.
    expect(stockOf(PRODUCT).on_hand).toBe(10);
  });

  it("allows an order for exactly the remaining stock", async () => {
    setStock(PRODUCT, { onHand: 4, reserved: 2 });

    const res = await order(PRODUCT, 2);

    expect(res.status).toBe(201);
    expect(stockOf(PRODUCT).reserved).toBe(4);
  });

  it("refuses an order beyond what is available", async () => {
    setStock(PRODUCT, { onHand: 2 });

    const res = await order(PRODUCT, 3);

    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/sold out/i);
  });

  it("names the product, so the cart can point at the line to change", async () => {
    setStock(PRODUCT, { onHand: 0 });

    const res = await order(PRODUCT, 1);

    const product = db.products.find((p) => p.id === PRODUCT);
    expect(res.body.error.message).toContain(product.name);
  });

  it("creates no order when stock is refused", async () => {
    setStock(PRODUCT, { onHand: 1 });
    const before = db.orders.length;

    await order(PRODUCT, 5);

    expect(db.orders).toHaveLength(before);
  });

  it("skips the check for made-to-order products", async () => {
    // track_stock = 0 exists so a bakery does not have to type a fake number
    // every morning for things it makes on demand.
    setStock(PRODUCT, { onHand: 0, trackStock: 0 });

    const res = await order(PRODUCT, 99);

    expect(res.status).toBe(201);
  });

  it("treats a product with no inventory row as untracked", async () => {
    // A missing row means stock was never set up, not "zero available" —
    // failing closed here would take the whole catalogue offline.
    const res = await order(PRODUCT, 2);
    expect(res.status).toBe(201);
  });
});

describe("multi-line orders", () => {
  it("unwinds earlier reservations when a later line fails", async () => {
    // Partially reserving an order that then fails is how stock leaks: the
    // customer gets an error and the shop still thinks the items are spoken for.
    setStock(1, { onHand: 10 });
    setStock(2, { onHand: 1 });

    const res = await request(app)
      .post("/api/v1/orders")
      .send({
        fulfillment: "Pickup",
        payment: "cash",
        contact: { name: "Test", phone: "0501234567" },
        items: [
          { product_id: 1, quantity: 2 },
          { product_id: 2, quantity: 5 },
        ],
      });

    expect(res.status).toBe(409);
    expect(stockOf(1).reserved).toBe(0);
    expect(stockOf(2).reserved).toBe(0);
  });
});

describe("oversell under concurrency", () => {
  it("sells the last unit exactly once", async () => {
    // The standard's scenario: two customers, one unit. One order, one refusal.
    setStock(PRODUCT, { onHand: 1 });

    const [a, b] = await Promise.all([order(PRODUCT, 1), order(PRODUCT, 1)]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);

    expect(stockOf(PRODUCT).reserved).toBe(1);
  });

  it("never reserves more than exists, whatever the order of arrival", async () => {
    setStock(PRODUCT, { onHand: 5 });

    const results = await Promise.all(
      Array.from({ length: 10 }, () => order(PRODUCT, 1))
    );

    const placed = results.filter((r) => r.status === 201).length;
    expect(placed).toBe(5);
    expect(stockOf(PRODUCT).reserved).toBeLessThanOrEqual(5);
  });
});

describe("settling the reservation", () => {
  it("puts stock back when an order is cancelled", async () => {
    setStock(PRODUCT, { onHand: 10 });
    const placed = await order(PRODUCT, 3);
    expect(stockOf(PRODUCT).reserved).toBe(3);

    await request(app)
      .patch(`/api/v1/admin/orders/${placed.body.orderNumber}/status`)
      .set("Cookie", `${ACCESS_COOKIE}=${adminToken()}`)
      .send({ status: STATUS.CANCELLED });

    expect(stockOf(PRODUCT).reserved).toBe(0);
    expect(stockOf(PRODUCT).on_hand).toBe(10);
  });

  it("consumes stock when an order is collected", async () => {
    setStock(PRODUCT, { onHand: 10 });
    const placed = await order(PRODUCT, 3);
    const tok = adminToken();
    const n = placed.body.orderNumber;

    for (const next of [STATUS.PREPARING, STATUS.READY, STATUS.COMPLETED]) {
      await request(app)
        .patch(`/api/v1/admin/orders/${n}/status`)
        .set("Cookie", `${ACCESS_COOKIE}=${tok}`)
        .send({ status: next });
    }

    // The goods have left: both figures drop, and the reservation is not left
    // holding stock that is no longer on the shelf.
    expect(stockOf(PRODUCT).on_hand).toBe(7);
    expect(stockOf(PRODUCT).reserved).toBe(0);
  });

  it("frees the stock for another customer after a cancellation", async () => {
    setStock(PRODUCT, { onHand: 1 });
    const first = await order(PRODUCT, 1);
    expect((await order(PRODUCT, 1)).status).toBe(409);

    await request(app)
      .patch(`/api/v1/admin/orders/${first.body.orderNumber}/status`)
      .set("Cookie", `${ACCESS_COOKIE}=${adminToken()}`)
      .send({ status: STATUS.CANCELLED });

    expect((await order(PRODUCT, 1)).status).toBe(201);
  });
});

describe("the ledger", () => {
  it("records a reservation against the order", async () => {
    setStock(PRODUCT, { onHand: 10 });
    const placed = await order(PRODUCT, 2);

    const entry = db.inventory_ledger.at(-1);
    expect(entry).toMatchObject({
      product_id: PRODUCT,
      delta: -2,
      reason: "reserved",
      ref_type: "order",
      ref_id: placed.body.orderNumber,
    });
  });

  it("records the release when an order is cancelled", async () => {
    setStock(PRODUCT, { onHand: 10 });
    const placed = await order(PRODUCT, 2);

    await request(app)
      .patch(`/api/v1/admin/orders/${placed.body.orderNumber}/status`)
      .set("Cookie", `${ACCESS_COOKIE}=${adminToken()}`)
      .send({ status: STATUS.CANCELLED });

    expect(db.inventory_ledger.at(-1)).toMatchObject({
      delta: 2,
      reason: "cancelled",
    });
  });
});

describe("admin stock endpoints", () => {
  it("lists stock with low-stock flagged", async () => {
    setStock(PRODUCT, { onHand: 3 });

    const res = await request(app)
      .get("/api/v1/admin/stock")
      .set("Cookie", `${ACCESS_COOKIE}=${adminToken()}`);

    expect(res.status).toBe(200);
    const row = res.body.find((r) => r.productId === PRODUCT);
    expect(row).toMatchObject({ onHand: 3, available: 3, lowStock: true });
  });

  it("sets a counted level and logs the difference", async () => {
    setStock(PRODUCT, { onHand: 4 });

    const res = await request(app)
      .patch(`/api/v1/admin/stock/${PRODUCT}`)
      .set("Cookie", `${ACCESS_COOKIE}=${adminToken()}`)
      .send({ onHand: 12 });

    expect(res.status).toBe(200);
    expect(res.body.onHand).toBe(12);
    // The ledger records the movement, not the new total.
    expect(db.inventory_ledger.at(-1)).toMatchObject({
      delta: 8,
      reason: "adjustment",
      actor_id: ADMIN_ID,
    });
  });

  it("rejects an empty update rather than reporting success", async () => {
    setStock(PRODUCT, { onHand: 4 });

    const res = await request(app)
      .patch(`/api/v1/admin/stock/${PRODUCT}`)
      .set("Cookie", `${ACCESS_COOKIE}=${adminToken()}`)
      .send({});

    expect(res.status).toBe(422);
  });

  it("refuses a customer", async () => {
    const customer = signAccessToken({
      id: 702,
      email: "c@example.test",
      role: "customer",
      tokenVersion: 0,
    });
    if (!db.users.find((u) => u.id === 702)) {
      db.users.push({ id: 702, email: "c@example.test", role: "customer", token_version: 0 });
    }

    const res = await request(app)
      .get("/api/v1/admin/stock")
      .set("Cookie", `${ACCESS_COOKIE}=${customer}`);

    expect(res.status).toBe(403);
  });
});
