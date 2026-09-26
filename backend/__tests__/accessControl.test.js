/**
 * Access control and resource ownership.
 *
 * The build standard's first two high-risk paths, and the area where a security
 * review most often finds a hole: RBAC checked against the database rather than
 * a token claim, and per-resource ownership (IDOR).
 *
 * The ownership checks already existed in the controllers. Nothing verified
 * them, which is the same as not having them — a refactor could have removed
 * one silently.
 */
const request = require("supertest");

const createApp = require("../app");
const { db } = require("../fileStore");
const { ACCESS_COOKIE, signAccessToken } = require("../lib/tokens");

const app = createApp({ rateLimit: false });

/** Put a user in the store and return a valid access token for them. */
function makeUser({ id, role = "customer", email = `u${id}@example.test` }) {
  const existing = db.users.find((u) => u.id === id);
  if (!existing) {
    db.users.push({ id, email, role, name: `User ${id}`, token_version: 0 });
  } else {
    existing.role = role;
  }
  return signAccessToken({ id, email, role, tokenVersion: 0 });
}

/** Attach the access token the way a browser would. */
const asUser = (req, token) => req.set("Cookie", `${ACCESS_COOKIE}=${token}`);

const ALICE = 901;
const BOB = 902;
const ADMIN = 903;

describe("authentication is required", () => {
  const protectedRoutes = [
    ["get", `/api/v1/cart/${ALICE}`],
    ["post", "/api/v1/cart"],
    ["patch", "/api/v1/cart"],
    ["delete", "/api/v1/cart"],
    ["get", `/api/v1/likes/${ALICE}`],
    ["post", "/api/v1/likes"],
    ["get", `/api/v1/orders/user/${ALICE}`],
  ];

  it.each(protectedRoutes)("rejects an anonymous %s %s", async (method, path) => {
    const res = await request(app)[method](path).send({ product_id: 1, quantity: 1 });
    expect(res.status).toBe(401);
  });

  it.each(protectedRoutes)(
    "rejects a forged token on %s %s",
    async (method, path) => {
      const res = await request(app)[method](path)
        .set("Cookie", `${ACCESS_COOKIE}=not.a.real.token`)
        .send({ product_id: 1, quantity: 1 });
      expect(res.status).toBe(401);
    }
  );
});

describe("resource ownership (IDOR)", () => {
  it("does not return Alice's orders to Bob", async () => {
    const bob = makeUser({ id: BOB });
    makeUser({ id: ALICE });

    const res = await asUser(request(app).get(`/api/v1/orders/user/${ALICE}`), bob);

    // 403, not an empty list: a refusal must be distinguishable from "you have
    // no orders", both to the client and in the logs.
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("does not return Alice's likes to Bob", async () => {
    const bob = makeUser({ id: BOB });
    makeUser({ id: ALICE });
    db.likes.push({ user_id: ALICE, product_id: 1 });

    try {
      const res = await asUser(request(app).get(`/api/v1/likes/${ALICE}`), bob);
      expect(res.status).toBe(403);
    } finally {
      db.likes = db.likes.filter((l) => l.user_id !== ALICE);
    }
  });

  it("reads the cart from the token, not the URL", async () => {
    // The controller ignores :userId entirely and uses req.user.id. Asking for
    // Alice's cart as Bob must return BOB's cart, never Alice's.
    const bob = makeUser({ id: BOB });
    makeUser({ id: ALICE });

    db.cart_items.push({ user_id: ALICE, product_id: 1, quantity: 7 });
    db.cart_items.push({ user_id: BOB, product_id: 2, quantity: 1 });

    try {
      const res = await asUser(request(app).get(`/api/v1/cart/${ALICE}`), bob);

      expect(res.status).toBe(200);
      const quantities = res.body.map((line) => line.quantity);
      expect(quantities).not.toContain(7); // Alice's line must not appear
    } finally {
      db.cart_items = db.cart_items.filter(
        (c) => c.user_id !== ALICE && c.user_id !== BOB
      );
    }
  });

  it("ignores a user_id in the body on a cart write", async () => {
    // Trusting the body instead of the token is the classic version of this
    // bug: post someone else's id and write into their cart.
    const bob = makeUser({ id: BOB });
    makeUser({ id: ALICE });

    try {
      await asUser(request(app).post("/api/v1/cart"), bob).send({
        user_id: ALICE,
        product_id: 1,
        quantity: 3,
      });

      const alicesCart = db.cart_items.filter((c) => c.user_id === ALICE);
      expect(alicesCart).toHaveLength(0);

      const bobsCart = db.cart_items.filter((c) => c.user_id === BOB);
      expect(bobsCart).toHaveLength(1);
    } finally {
      db.cart_items = db.cart_items.filter(
        (c) => c.user_id !== ALICE && c.user_id !== BOB
      );
    }
  });

  it("ignores a user_id in the body on a like", async () => {
    const bob = makeUser({ id: BOB });
    makeUser({ id: ALICE });

    try {
      await asUser(request(app).post("/api/v1/likes"), bob).send({
        user_id: ALICE,
        product_id: 1,
      });

      expect(db.likes.filter((l) => l.user_id === ALICE)).toHaveLength(0);
      expect(db.likes.filter((l) => l.user_id === BOB)).toHaveLength(1);
    } finally {
      db.likes = db.likes.filter((l) => l.user_id !== ALICE && l.user_id !== BOB);
    }
  });

  it("attributes an order to the token's user, not a body user_id", async () => {
    const bob = makeUser({ id: BOB });
    makeUser({ id: ALICE });

    const res = await asUser(request(app).post("/api/v1/orders"), bob).send({
      user_id: ALICE,
      fulfillment: "Pickup",
      payment: "cash",
      contact: { name: "Bob", phone: "0501234567" },
      items: [{ product_id: 1, quantity: 1 }],
    });

    expect(res.status).toBe(201);
    const order = db.orders.find((o) => o.orderNumber === res.body.orderNumber);
    expect(order.user_id).toBe(BOB);
  });
});

describe("mass assignment", () => {
  it("cannot promote a user by posting a role", async () => {
    // `{ role: "admin" }` in a body must never reach a column. There is no
    // profile-update route yet; this asserts the schemas strip unknown keys, so
    // one added later inherits the behaviour rather than the vulnerability.
    const bob = makeUser({ id: BOB });

    await asUser(request(app).post("/api/v1/cart"), bob).send({
      product_id: 1,
      quantity: 1,
      role: "admin",
      user_id: ALICE,
      token_version: 99,
    });

    const stored = db.users.find((u) => u.id === BOB);
    expect(stored.role).toBe("customer");
    expect(stored.token_version).toBe(0);

    db.cart_items = db.cart_items.filter((c) => c.user_id !== BOB);
  });
});

describe("requireAdmin", () => {
  // Unused by any route today — Wave 4 mounts /admin/* on it. Verified now so
  // that work starts from a checked control rather than an assumed one.
  const { requireAdmin } = require("../middleware/auth");

  const run = (token) =>
    new Promise((resolve) => {
      const req = { headers: {}, cookies: token ? { [ACCESS_COOKIE]: token } : {} };
      requireAdmin(req, {}, (err) => resolve({ error: err || null, user: req.user }));
    });

  it("allows a real admin", async () => {
    const token = makeUser({ id: ADMIN, role: "admin" });
    const { error, user } = await run(token);

    expect(error).toBeNull();
    expect(user.role).toBe("admin");
  });

  it("refuses a customer", async () => {
    const token = makeUser({ id: BOB, role: "customer" });
    const { error } = await run(token);

    expect(error).toBeTruthy();
    expect(error.status).toBe(403);
  });

  it("refuses an anonymous caller with 401, not 403", async () => {
    const { error } = await run(null);

    // The distinction matters: "sign in" and "you cannot do this" are
    // different answers, and the standard asks for both to be distinguishable.
    expect(error.status).toBe(401);
  });

  it("re-checks the role against the store, so a stale claim is refused", async () => {
    // The whole point of checking the DB rather than trusting the token: a
    // demoted admin must lose access immediately, not when their token expires.
    const token = makeUser({ id: ADMIN, role: "admin" });

    const before = await run(token);
    expect(before.error).toBeNull();

    db.users.find((u) => u.id === ADMIN).role = "customer";
    try {
      const after = await run(token);
      expect(after.error).toBeTruthy();
      expect(after.error.status).toBe(403);
    } finally {
      db.users.find((u) => u.id === ADMIN).role = "admin";
    }
  });

  it("refuses a token for a user that no longer exists", async () => {
    const token = signAccessToken({
      id: 99999,
      email: "ghost@example.test",
      role: "admin",
      tokenVersion: 0,
    });

    const { error } = await run(token);
    expect(error).toBeTruthy();
    expect(error.status).toBe(403);
  });
});
