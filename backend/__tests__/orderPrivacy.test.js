/**
 * Order tracking privacy.
 *
 * `GET /orders/track/:orderNumber` takes no auth by design, so a gift recipient
 * can follow an order without an account. That makes whatever it returns
 * readable by anyone holding — or guessing — an order number.
 *
 * Two things must hold: the number must not be guessable from another number,
 * and the response must carry nothing worth scraping.
 */
const request = require("supertest");

const createApp = require("../app");
const {
  generateOrderNumber,
  normalizeOrderNumber,
  isValidOrderNumber,
} = require("../lib/orderNumber");

const app = createApp({ rateLimit: false });

const CONTACT = {
  name: "Ammar Al Nuaimi",
  phone: "0501234567",
  address: "Villa 12, Street 4",
  city: "Al Ain",
  note: "gate code 4471",
};

const place = () =>
  request(app)
    .post("/api/v1/orders")
    .send({
      fulfillment: "Delivery",
      payment: "cash",
      contact: CONTACT,
      items: [{ product_id: 1, quantity: 1 }],
    });

describe("the public tracking response", () => {
  it("returns no customer contact details at all", async () => {
    const placed = await place();
    const res = await request(app).get(`/api/v1/orders/track/${placed.body.orderNumber}`);

    expect(res.status).toBe(200);
    expect(res.body.contact).toBeUndefined();

    // Belt and braces: assert on the serialised body, so a value nested
    // somewhere unexpected still fails rather than slipping past a key check.
    const body = JSON.stringify(res.body);
    for (const secret of Object.values(CONTACT)) {
      expect(body).not.toContain(secret);
    }
  });

  it("does not expose internal or ownership identifiers", async () => {
    const placed = await place();
    const res = await request(app).get(`/api/v1/orders/track/${placed.body.orderNumber}`);

    expect(res.body.id).toBeUndefined();
    expect(res.body.user_id).toBeUndefined();
    expect(res.body.payment).toBeUndefined();
  });

  it("still answers the question the page exists to answer", async () => {
    const placed = await place();
    const res = await request(app).get(`/api/v1/orders/track/${placed.body.orderNumber}`);

    expect(res.body).toMatchObject({
      orderNumber: placed.body.orderNumber,
      status: expect.any(String),
      fulfillment: "Delivery",
      currency: "AED",
    });
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].name_snapshot).toBeTruthy();
  });

  it("returns only safe fields on each line item", async () => {
    const placed = await place();
    const res = await request(app).get(`/api/v1/orders/track/${placed.body.orderNumber}`);

    expect(Object.keys(res.body.items[0]).sort()).toEqual([
      "currency",
      "name_snapshot",
      "quantity",
      "unit_price_minor",
    ]);
  });

  it("is an allowlist, so an unexpected field cannot appear", async () => {
    const placed = await place();
    const res = await request(app).get(`/api/v1/orders/track/${placed.body.orderNumber}`);

    // Pinned deliberately: adding a column to `orders` must not widen this
    // response. If a new field belongs here, this test is the place to say so.
    expect(Object.keys(res.body).sort()).toEqual([
      "createdAt",
      "currency",
      "fulfillment",
      "items",
      "orderNumber",
      "status",
      "totalMinor",
    ]);
  });
});

describe("order numbers are not guessable", () => {
  it("is not derived from a sequential id", async () => {
    const a = await place();
    const b = await place();

    const [x, y] = [a.body.orderNumber, b.body.orderNumber];
    expect(x).not.toBe(y);

    // The old format was FL${insertId}: consecutive orders differed by one.
    expect(x).not.toMatch(/^FL\d+$/);
    expect(y).not.toMatch(/^FL\d+$/);
  });

  it("does not collide across a large batch", () => {
    const seen = new Set();
    for (let i = 0; i < 5000; i += 1) seen.add(generateOrderNumber());
    expect(seen.size).toBe(5000);
  });

  it("uses an alphabet with no visually ambiguous characters", () => {
    // I/L/O/U are excluded so a number read down a phone cannot be mistyped,
    // and no order number can accidentally spell a word. Checked on the random
    // body only — the fixed FL prefix legitimately contains an L.
    for (let i = 0; i < 200; i += 1) {
      expect(generateOrderNumber().slice(2)).not.toMatch(/[ILOU]/);
    }
  });

  it("produces a consistent, recognisable shape", () => {
    const n = generateOrderNumber();
    expect(n).toMatch(/^FL[0-9A-Z]{8}$/);
    expect(isValidOrderNumber(n)).toBe(true);
  });
});

describe("normalising what a customer typed", () => {
  it("accepts lowercase, spaces and dashes", () => {
    expect(normalizeOrderNumber(" fl 3k9-2mtq7 ")).toBe("FL3K92MTQ7");
  });

  it("maps the characters the alphabet excludes onto what was meant", () => {
    // Someone copying off a screen types O for 0 and I for 1 constantly.
    expect(normalizeOrderNumber("FLO1I23456")).toBe("FL01123456");
  });

  it("does not throw on rubbish input", () => {
    expect(normalizeOrderNumber(null)).toBe("");
    expect(normalizeOrderNumber(undefined)).toBe("");
    expect(normalizeOrderNumber(12345)).toBe("");
  });
});

describe("a lookup that finds nothing", () => {
  it("404s a well-formed but unknown number", async () => {
    const res = await request(app).get(`/api/v1/orders/track/${generateOrderNumber()}`);
    expect(res.status).toBe(404);
  });

  it("404s a malformed number without reaching the database", async () => {
    const res = await request(app).get("/api/v1/orders/track/not-an-order");
    expect(res.status).toBe(404);
  });

  it("gives the same answer either way, so it is not an oracle", async () => {
    const unknown = await request(app).get(
      `/api/v1/orders/track/${generateOrderNumber()}`
    );
    const malformed = await request(app).get("/api/v1/orders/track/zzzz");

    expect(unknown.status).toBe(malformed.status);
    expect(unknown.body.error.message).toBe(malformed.body.error.message);
  });
});
