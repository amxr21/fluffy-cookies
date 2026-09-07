/**
 * Pagination on list endpoints.
 *
 * Every list returned everything it had. The standard's wording is exact: an
 * unbounded `GET /orders` is a production incident waiting for the store to
 * succeed — fine until a customer has four hundred orders, then slow for
 * everyone because the query holds the connection.
 *
 * The cap has to be enforced server-side; a client asking for 100000 must
 * receive the maximum, not what it asked for.
 */
const request = require("supertest");

const createApp = require("../app");
const { db } = require("../fileStore");
const { ACCESS_COOKIE, signAccessToken } = require("../lib/tokens");
const { readPageParams, paginated, slice, MAX_LIMIT, DEFAULT_LIMIT } = require("../lib/pagination");

const app = createApp({ rateLimit: false });

const USER_ID = 401;

function userToken() {
  if (!db.users.find((u) => u.id === USER_ID)) {
    db.users.push({ id: USER_ID, email: "p@example.test", role: "customer", token_version: 0 });
  }
  return signAccessToken({ id: USER_ID, email: "p@example.test", role: "customer", tokenVersion: 0 });
}

describe("readPageParams", () => {
  it("defaults when nothing is asked for", () => {
    expect(readPageParams({})).toEqual({ limit: DEFAULT_LIMIT, offset: 0 });
  });

  it("caps the limit server-side", () => {
    // The whole point: a client cannot ask for the entire table.
    expect(readPageParams({ limit: "100000" }).limit).toBe(MAX_LIMIT);
  });

  it("falls back rather than 400ing on rubbish", () => {
    // This is a read; a bookmarked URL with a bad param should still work.
    expect(readPageParams({ limit: "abc" }).limit).toBe(DEFAULT_LIMIT);
    expect(readPageParams({ offset: "-5" }).offset).toBe(0);
    expect(readPageParams({ limit: "0" }).limit).toBe(DEFAULT_LIMIT);
  });

  it("accepts a sensible request", () => {
    expect(readPageParams({ limit: "5", offset: "10" })).toEqual({ limit: 5, offset: 10 });
  });
});

describe("the envelope", () => {
  it("reports hasMore from the total when one is known", () => {
    const out = paginated([1, 2], { limit: 2, offset: 0, total: 5 });
    expect(out.page).toMatchObject({ count: 2, hasMore: true, total: 5 });
  });

  it("knows the last page is the last", () => {
    const out = paginated([1], { limit: 2, offset: 4, total: 5 });
    expect(out.page.hasMore).toBe(false);
  });

  it("infers hasMore from a full page when no total is given", () => {
    expect(paginated([1, 2], { limit: 2, offset: 0 }).page.hasMore).toBe(true);
    expect(paginated([1], { limit: 2, offset: 0 }).page.hasMore).toBe(false);
  });

  it("handles an empty result without pretending there is more", () => {
    const out = paginated([], { limit: 20, offset: 0, total: 0 });
    expect(out.page).toMatchObject({ count: 0, hasMore: false });
  });
});

describe("slice", () => {
  const rows = [1, 2, 3, 4, 5];

  it("returns the requested window", () => {
    expect(slice(rows, { limit: 2, offset: 1 })).toEqual([2, 3]);
  });

  it("returns nothing past the end rather than throwing", () => {
    expect(slice(rows, { limit: 2, offset: 99 })).toEqual([]);
  });
});

describe("GET /products", () => {
  it("returns a bounded page by default", async () => {
    const res = await request(app).get("/api/v1/products");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeLessThanOrEqual(DEFAULT_LIMIT);
    expect(res.body.page.total).toBe(db.products.length);
  });

  it("honours limit and offset", async () => {
    const first = await request(app).get("/api/v1/products?limit=2&offset=0");
    const second = await request(app).get("/api/v1/products?limit=2&offset=2");

    expect(first.body.data).toHaveLength(2);
    expect(second.body.data).toHaveLength(2);
    // Different windows, so no row appears in both.
    expect(first.body.data[0].id).not.toBe(second.body.data[0].id);
  });

  it("refuses to return more than the maximum however much is asked for", async () => {
    const res = await request(app).get("/api/v1/products?limit=999999");
    expect(res.body.page.limit).toBe(MAX_LIMIT);
  });

  it("says when there is more to fetch", async () => {
    const res = await request(app).get("/api/v1/products?limit=1");
    expect(res.body.page.hasMore).toBe(true);
  });
});

describe("GET /orders/user/:id", () => {
  it("pages a customer's order history", async () => {
    const token = userToken();

    // Three orders, so a page of two leaves one behind.
    for (let i = 0; i < 3; i += 1) {
      await request(app)
        .post("/api/v1/orders")
        .set("Cookie", `${ACCESS_COOKIE}=${token}`)
        .send({
          fulfillment: "Pickup",
          payment: "cash",
          contact: { name: "P", phone: "0501234567" },
          items: [{ product_id: 1, quantity: 1 }],
        });
    }

    const res = await request(app)
      .get(`/api/v1/orders/user/${USER_ID}?limit=2`)
      .set("Cookie", `${ACCESS_COOKIE}=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.page.hasMore).toBe(true);
    expect(res.body.page.total).toBeGreaterThanOrEqual(3);
  });

  it("still refuses another user's history", async () => {
    // Pagination must not have widened what is reachable.
    const token = userToken();
    const res = await request(app)
      .get(`/api/v1/orders/user/999?limit=5`)
      .set("Cookie", `${ACCESS_COOKIE}=${token}`);

    expect(res.status).toBe(403);
  });
});

describe("GET /likes/:id", () => {
  it("returns the envelope", async () => {
    const token = userToken();
    const res = await request(app)
      .get(`/api/v1/likes/${USER_ID}`)
      .set("Cookie", `${ACCESS_COOKIE}=${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("page");
  });
});
