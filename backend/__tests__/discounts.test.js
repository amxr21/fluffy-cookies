/**
 * Discount codes.
 *
 * The checkout form has always collected a code and the schema has always
 * accepted it — and nothing ever read it. A customer typing FLUFFY10 saw no
 * error and was charged full price.
 *
 * B10.4 treats discount abuse as its own class of attack, so these cover the
 * limits as much as the happy path: the window, the minimum, the usage cap, the
 * per-user cap, and whether the endpoint is a code-guessing oracle.
 */
const request = require("supertest");

const createApp = require("../app");
const { db } = require("../fileStore");
const { ACCESS_COOKIE, signAccessToken } = require("../lib/tokens");
const {
  normalizeCode,
  computeDiscountMinor,
  validateDiscount,
  REJECT,
} = require("../lib/discounts");

const app = createApp({ rateLimit: false });

const USER_ID = 601;

function userToken(id = USER_ID) {
  if (!db.users.find((u) => u.id === id)) {
    db.users.push({ id, email: `d${id}@example.test`, role: "customer", token_version: 0 });
  }
  return signAccessToken({ id, email: `d${id}@example.test`, role: "customer", tokenVersion: 0 });
}

let nextDiscountId = 1;
function makeDiscount(overrides = {}) {
  const row = {
    id: nextDiscountId++,
    code: "FLUFFY10",
    type: "percent",
    value: 10,
    max_discount_minor: null,
    min_subtotal_minor: 0,
    starts_at: null,
    ends_at: null,
    usage_limit: null,
    per_user_limit: 1,
    used_count: 0,
    active: 1,
    ...overrides,
  };
  db.discounts.push(row);
  return row;
}

/** Product 1 is 4800 fils; one of it makes the maths easy to follow. */
const place = (code, token) => {
  const req = request(app).post("/api/v1/orders");
  if (token) req.set("Cookie", `${ACCESS_COOKIE}=${token}`);
  return req.send({
    fulfillment: "Pickup",
    payment: "cash",
    contact: { name: "Test", phone: "0501234567" },
    items: [{ product_id: 1, quantity: 1 }],
    ...(code ? { discount_code: code } : {}),
  });
};

afterEach(() => {
  db.discounts = [];
  db.discount_redemptions = [];
});

describe("computing what a code is worth", () => {
  it("takes a percentage of the subtotal", () => {
    expect(computeDiscountMinor({ type: "percent", value: 10 }, 4800)).toBe(480);
  });

  it("takes a fixed amount in minor units", () => {
    expect(computeDiscountMinor({ type: "fixed", value: 1000 }, 4800)).toBe(1000);
  });

  it("never discounts more than the subtotal", () => {
    // A total below zero would mean paying the customer.
    expect(computeDiscountMinor({ type: "fixed", value: 99999 }, 4800)).toBe(4800);
  });

  it("respects a cap on a percentage code", () => {
    expect(
      computeDiscountMinor({ type: "percent", value: 50, max_discount_minor: 1000 }, 10000)
    ).toBe(1000);
  });

  it("returns a whole number of fils", () => {
    // 15% of 4855 is 728.25 — must not leak a fraction into a total.
    const out = computeDiscountMinor({ type: "percent", value: 15 }, 4855);
    expect(Number.isInteger(out)).toBe(true);
  });
});

describe("the limits", () => {
  const base = { subtotalMinor: 10000 };

  it("refuses an inactive code", () => {
    const r = validateDiscount({ ...base, discount: makeDiscount({ active: 0 }) });
    expect(r).toMatchObject({ ok: false, reason: REJECT.INACTIVE });
  });

  it("refuses a code before it starts", () => {
    const starts = new Date(Date.now() + 86400000);
    const r = validateDiscount({ ...base, discount: makeDiscount({ starts_at: starts }) });
    expect(r).toMatchObject({ ok: false, reason: REJECT.NOT_STARTED });
  });

  it("refuses an expired code", () => {
    const ends = new Date(Date.now() - 86400000);
    const r = validateDiscount({ ...base, discount: makeDiscount({ ends_at: ends }) });
    expect(r).toMatchObject({ ok: false, reason: REJECT.EXPIRED });
  });

  it("refuses below the minimum subtotal", () => {
    const r = validateDiscount({
      discount: makeDiscount({ min_subtotal_minor: 20000 }),
      subtotalMinor: 10000,
    });
    expect(r).toMatchObject({ ok: false, reason: REJECT.MIN_SUBTOTAL });
  });

  it("refuses once the usage limit is spent", () => {
    const r = validateDiscount({
      ...base,
      discount: makeDiscount({ usage_limit: 5, used_count: 5 }),
    });
    expect(r).toMatchObject({ ok: false, reason: REJECT.USAGE_LIMIT });
  });

  it("refuses a second use by the same customer", () => {
    const r = validateDiscount({
      ...base,
      discount: makeDiscount({ per_user_limit: 1 }),
      userRedemptions: 1,
    });
    expect(r).toMatchObject({ ok: false, reason: REJECT.PER_USER_LIMIT });
  });

  it("accepts a code inside its window", () => {
    const r = validateDiscount({
      ...base,
      discount: makeDiscount({
        starts_at: new Date(Date.now() - 1000),
        ends_at: new Date(Date.now() + 86400000),
      }),
    });
    expect(r.ok).toBe(true);
  });
});

describe("normalising what a customer typed", () => {
  it("is case and whitespace insensitive", () => {
    expect(normalizeCode("  fluffy10 ")).toBe("FLUFFY10");
    expect(normalizeCode("fluffy 10")).toBe("FLUFFY10");
  });

  it("does not throw on rubbish", () => {
    expect(normalizeCode(null)).toBe("");
    expect(normalizeCode(42)).toBe("");
  });
});

describe("placing an order with a code", () => {
  it("applies the discount to the total", async () => {
    makeDiscount({ code: "FLUFFY10", type: "percent", value: 10 });

    const res = await place("FLUFFY10", userToken());

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      subtotalMinor: 4800,
      discountCode: "FLUFFY10",
      discountMinor: 480,
      totalMinor: 4320,
    });
  });

  it("accepts the code however it was typed", async () => {
    makeDiscount({ code: "FLUFFY10" });

    const res = await place("  fluffy10 ", userToken());

    expect(res.status).toBe(201);
    expect(res.body.discountMinor).toBe(480);
  });

  it("refuses an unknown code rather than charging full price silently", async () => {
    // The bug this replaces: no error, no discount, full charge.
    const res = await place("NOTAREALCODE", userToken());

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/isn't valid/i);
  });

  it("refuses an expired code at placement, not only at checking", async () => {
    makeDiscount({ code: "OLD", ends_at: new Date(Date.now() - 86400000) });

    const res = await place("OLD", userToken());
    expect(res.status).toBe(400);
  });

  it("records the redemption against the order", async () => {
    const d = makeDiscount({ code: "FLUFFY10" });

    const res = await place("FLUFFY10", userToken());

    const redemption = db.discount_redemptions.at(-1);
    expect(redemption).toMatchObject({
      discount_id: d.id,
      user_id: USER_ID,
      amount_minor: 480,
    });
    const order = db.orders.find((o) => o.orderNumber === res.body.orderNumber);
    expect(order.discount_minor).toBe(480);
  });

  it("increments the usage count transactionally", async () => {
    const d = makeDiscount({ code: "FLUFFY10", per_user_limit: null });

    await place("FLUFFY10", userToken());
    await place("FLUFFY10", userToken());

    expect(db.discounts.find((x) => x.id === d.id).used_count).toBe(2);
  });

  it("stops at the usage limit even under concurrent placement", async () => {
    // Two customers racing for the last use: one redeems, one is refused.
    makeDiscount({ code: "LAST1", usage_limit: 1, per_user_limit: null });

    const [a, b] = await Promise.all([
      place("LAST1", userToken(611)),
      place("LAST1", userToken(612)),
    ]);

    const codes = [a.status, b.status].sort();
    expect(codes).toEqual([201, 400]);
    expect(db.discount_redemptions).toHaveLength(1);
  });

  it("refuses a customer's second use of a one-per-customer code", async () => {
    makeDiscount({ code: "ONCE", per_user_limit: 1 });
    const token = userToken();

    expect((await place("ONCE", token)).status).toBe(201);

    const second = await place("ONCE", token);
    expect(second.status).toBe(400);
    expect(second.body.error.message).toMatch(/already used/i);
  });

  it("places a normal order when no code is sent", async () => {
    const res = await place(null, userToken());

    expect(res.status).toBe(201);
    expect(res.body.discountMinor).toBe(0);
    expect(res.body.totalMinor).toBe(4800);
  });
});

describe("POST /orders/discount/check", () => {
  const check = (body) => request(app).post("/api/v1/orders/discount/check").send(body);

  it("reports what a valid code is worth before submitting", async () => {
    makeDiscount({ code: "FLUFFY10" });

    const res = await check({ code: "FLUFFY10", subtotal_minor: 10000 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      valid: true,
      code: "FLUFFY10",
      discountMinor: 1000,
      totalMinor: 9000,
    });
  });

  it("claims nothing, so checking is not spending", async () => {
    const d = makeDiscount({ code: "FLUFFY10" });

    await check({ code: "FLUFFY10", subtotal_minor: 10000 });
    await check({ code: "FLUFFY10", subtotal_minor: 10000 });

    expect(db.discounts.find((x) => x.id === d.id).used_count).toBe(0);
    expect(db.discount_redemptions).toHaveLength(0);
  });

  it("answers 200 with valid:false rather than an error status", async () => {
    // A wrong code is a normal outcome of typing, not a failure to report.
    const res = await check({ code: "NOPE", subtotal_minor: 10000 });

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
  });

  it("is not a code-guessing oracle", async () => {
    // An endpoint that says "expired" vs "no such code" tells an attacker which
    // guesses were real. Both must read the same.
    makeDiscount({ code: "EXPIRED1", ends_at: new Date(Date.now() - 86400000) });

    const unknown = await check({ code: "ZZZZZZZZ", subtotal_minor: 10000 });
    const expired = await check({ code: "EXPIRED1", subtotal_minor: 10000 });

    expect(unknown.body.message).toBe(expired.body.message);
  });

  it("does name a limit the customer can act on", async () => {
    // Telling someone to spend more is helpful and leaks nothing.
    makeDiscount({ code: "BIG", min_subtotal_minor: 20000 });

    const res = await check({ code: "BIG", subtotal_minor: 10000 });
    expect(res.body.message).toMatch(/minimum/i);
  });

  it("rejects a malformed body", async () => {
    const res = await check({ code: "" });
    expect(res.status).toBe(422);
  });
});
