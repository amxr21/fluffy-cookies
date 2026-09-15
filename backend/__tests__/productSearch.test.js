/**
 * Product search and detail.
 *
 * The standard puts search at Tier 1 "even if it's a LIKE query" — a store you
 * cannot search is a catalogue. With 16 products anything cleverer is
 * premature; what matters is that the query is safe and the endpoint honest.
 */
const request = require("supertest");

const createApp = require("../app");
const { db } = require("../fileStore");

const app = createApp({ rateLimit: false });

describe("GET /products?q=", () => {
  it("matches on name", async () => {
    const res = await request(app).get("/api/v1/products?q=matcha");

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const p of res.body.data) {
      expect(`${p.name} ${p.description}`.toLowerCase()).toContain("matcha");
    }
  });

  it("matches on description too", async () => {
    // Someone searching "biscoff" is describing a flavour, not a product name.
    const res = await request(app).get("/api/v1/products?q=biscoff");
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it("is case insensitive", async () => {
    const lower = await request(app).get("/api/v1/products?q=cookie");
    const upper = await request(app).get("/api/v1/products?q=COOKIE");
    expect(upper.body.page.total).toBe(lower.body.page.total);
  });

  it("returns an empty page rather than everything when nothing matches", async () => {
    // Falling back to the full catalogue would tell the customer their search
    // succeeded when it did not.
    const res = await request(app).get("/api/v1/products?q=zzzznotathing");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.page.total).toBe(0);
  });

  it("does not treat a wildcard as a wildcard", async () => {
    // Unescaped, "%" in a LIKE matches every row — the customer searches for a
    // discount and gets the whole menu.
    const res = await request(app).get("/api/v1/products?q=%25");
    expect(res.body.data.length).toBeLessThan(db.products.length);
  });

  it("returns the full list when no term is given", async () => {
    const res = await request(app).get("/api/v1/products");
    expect(res.body.page.total).toBe(db.products.length);
  });

  it("pages results like any other list", async () => {
    const res = await request(app).get("/api/v1/products?q=cookie&limit=1");
    expect(res.body.data).toHaveLength(1);
    expect(res.body.page.limit).toBe(1);
  });
});

describe("GET /products/:id", () => {
  it("returns one product", async () => {
    const res = await request(app).get("/api/v1/products/1");

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(1);
    expect(res.body.price_minor).toBeGreaterThan(0);
  });

  it("404s an unknown id", async () => {
    const res = await request(app).get("/api/v1/products/99999");
    expect(res.status).toBe(404);
  });

  it("422s a non-numeric id rather than reaching the database", async () => {
    const res = await request(app).get("/api/v1/products/not-a-number");
    expect(res.status).toBe(422);
  });

  it("needs no authentication", async () => {
    const res = await request(app).get("/api/v1/products/1");
    expect(res.status).toBe(200);
  });
});
