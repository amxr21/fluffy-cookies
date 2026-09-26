/**
 * Transactional email.
 *
 * `/order-success` has always promised "you'll receive a notification once
 * everything is ready" and nothing sent one.
 *
 * The rule that matters most here is B9's: a send failure must never fail the
 * order. An order that exists but whose confirmation bounced is a support
 * ticket; an order rejected because a mail provider was down is lost revenue.
 */
const request = require("supertest");

const createApp = require("../app");
const { db } = require("../fileStore");
const { ACCESS_COOKIE, signAccessToken } = require("../lib/tokens");
const { STATUS } = require("../lib/orderStatus");
const mailer = require("../email/mailer");
const templates = require("../email/templates");

const app = createApp({ rateLimit: false });

const ADMIN_ID = 301;

function adminToken() {
  if (!db.users.find((u) => u.id === ADMIN_ID)) {
    db.users.push({
      id: ADMIN_ID,
      email: "mail-admin@example.test",
      role: "admin",
      token_version: 0,
    });
  }
  return signAccessToken({
    id: ADMIN_ID,
    email: "mail-admin@example.test",
    role: "admin",
    tokenVersion: 0,
  });
}

const order = (contact = {}) =>
  request(app)
    .post("/api/v1/orders")
    .send({
      fulfillment: "Pickup",
      payment: "cash",
      contact: { name: "Test", phone: "0501234567", ...contact },
      items: [{ product_id: 1, quantity: 2 }],
    });

/** Capture what the mailer was asked to send, without touching a network. */
function captureSends() {
  const sent = [];
  const original = mailer.adapter.send;
  mailer.adapter.send = async (message) => {
    sent.push(message);
    return { id: `test-${sent.length}` };
  };
  return {
    sent,
    restore: () => {
      mailer.adapter.send = original;
    },
  };
}

describe("templates", () => {
  const sample = {
    orderNumber: "FL3K92MTQ7",
    totalMinor: 9600,
    currency: "AED",
    fulfillment: "Pickup",
    items: [
      { name_snapshot: "Classic Chocolate Chip", quantity: 2, unit_price_minor: 4800, currency: "AED" },
    ],
  };

  it("always ships a plain-text alternative", () => {
    // Measurably improves inbox placement, and some clients still show it.
    for (const name of Object.keys(templates)) {
      const out = templates[name](sample);
      expect(out.subject).toBeTruthy();
      expect(out.html).toBeTruthy();
      expect(out.text).toBeTruthy();
    }
  });

  it("puts the order number in the subject, where a customer scans for it", () => {
    expect(templates.orderConfirmed(sample).subject).toContain("FL3K92MTQ7");
    expect(templates.orderReady(sample).subject).toContain("FL3K92MTQ7");
  });

  it("formats money rather than printing minor units", () => {
    // "9600" in a receipt would read as nine thousand six hundred dirhams.
    const html = templates.orderConfirmed(sample).html;
    expect(html).toContain("96.00");
    expect(html).not.toMatch(/>9600</);
  });

  it("escapes customer-supplied text", () => {
    // A product name is untrusted input in an email too.
    const out = templates.orderConfirmed({
      ...sample,
      items: [
        { name_snapshot: '<script>alert(1)</script>', quantity: 1, unit_price_minor: 100, currency: "AED" },
      ],
    });
    expect(out.html).not.toContain("<script>");
    expect(out.html).toContain("&lt;script&gt;");
  });

  it("says collection or delivery, matching the order", () => {
    expect(templates.orderReady({ ...sample, fulfillment: "Delivery" }).text).toMatch(
      /delivery/i
    );
    expect(templates.orderReady({ ...sample, fulfillment: "Pickup" }).text).toMatch(
      /collection/i
    );
  });
});

describe("the mailer", () => {
  it("sends a known template", async () => {
    const cap = captureSends();
    try {
      const res = await mailer.send("orderConfirmed", "customer@example.test", {
        orderNumber: "FL1",
        totalMinor: 100,
        currency: "AED",
        items: [],
      });

      expect(res.sent).toBe(true);
      expect(cap.sent).toHaveLength(1);
      expect(cap.sent[0].to).toBe("customer@example.test");
    } finally {
      cap.restore();
    }
  });

  it("skips silently when there is no recipient", async () => {
    // A guest ordering without an email is normal, not an error.
    const res = await mailer.send("orderConfirmed", null, {});
    expect(res).toMatchObject({ sent: false, reason: "NO_RECIPIENT" });
  });

  it("reports an unknown template rather than throwing", async () => {
    const res = await mailer.send("noSuchTemplate", "a@b.test", {});
    expect(res).toMatchObject({ sent: false, reason: "UNKNOWN_TEMPLATE" });
  });

  it("never throws when the provider fails", async () => {
    // The whole point: a provider outage must not become a checkout outage.
    const original = mailer.adapter.send;
    mailer.adapter.send = async () => {
      throw new Error("provider is down");
    };
    try {
      const res = await mailer.send("orderConfirmed", "a@b.test", {
        orderNumber: "FL1",
        totalMinor: 100,
        currency: "AED",
        items: [],
      });
      expect(res).toMatchObject({ sent: false, reason: "SEND_FAILED" });
    } finally {
      mailer.adapter.send = original;
    }
  });
});

describe("order confirmation", () => {
  it("is sent when an email was given", async () => {
    const cap = captureSends();
    try {
      const res = await order({ email: "buyer@example.test" });
      expect(res.status).toBe(201);

      // Fire-and-forget, so give the microtask a turn.
      await new Promise((r) => setTimeout(r, 10));

      expect(cap.sent).toHaveLength(1);
      expect(cap.sent[0].to).toBe("buyer@example.test");
      expect(cap.sent[0].subject).toContain(res.body.orderNumber);
    } finally {
      cap.restore();
    }
  });

  it("places the order fine when no email was given", async () => {
    const cap = captureSends();
    try {
      const res = await order();
      expect(res.status).toBe(201);
      await new Promise((r) => setTimeout(r, 10));
      expect(cap.sent).toHaveLength(0);
    } finally {
      cap.restore();
    }
  });

  it("still places the order when sending fails", async () => {
    // The decisive test for B9.
    const original = mailer.adapter.send;
    mailer.adapter.send = async () => {
      throw new Error("provider is down");
    };
    try {
      const res = await order({ email: "buyer@example.test" });
      expect(res.status).toBe(201);
      expect(res.body.orderNumber).toBeTruthy();
    } finally {
      mailer.adapter.send = original;
    }
  });
});

describe("status notifications", () => {
  it("emails the customer when the order is ready", async () => {
    const placed = await order({ email: "buyer@example.test" });
    const tok = adminToken();
    const n = placed.body.orderNumber;

    await request(app)
      .patch(`/api/v1/admin/orders/${n}/status`)
      .set("Cookie", `${ACCESS_COOKIE}=${tok}`)
      .send({ status: STATUS.PREPARING });

    const cap = captureSends();
    try {
      await request(app)
        .patch(`/api/v1/admin/orders/${n}/status`)
        .set("Cookie", `${ACCESS_COOKIE}=${tok}`)
        .send({ status: STATUS.READY });

      await new Promise((r) => setTimeout(r, 10));

      expect(cap.sent).toHaveLength(1);
      expect(cap.sent[0].subject).toMatch(/ready/i);
    } finally {
      cap.restore();
    }
  });

  it("emails on cancellation", async () => {
    const placed = await order({ email: "buyer@example.test" });
    const cap = captureSends();
    try {
      await request(app)
        .patch(`/api/v1/admin/orders/${placed.body.orderNumber}/status`)
        .set("Cookie", `${ACCESS_COOKIE}=${adminToken()}`)
        .send({ status: STATUS.CANCELLED });

      await new Promise((r) => setTimeout(r, 10));

      expect(cap.sent).toHaveLength(1);
      expect(cap.sent[0].subject).toMatch(/cancelled/i);
    } finally {
      cap.restore();
    }
  });

  it("sends nothing for an intermediate step the customer need not hear about", async () => {
    const placed = await order({ email: "buyer@example.test" });
    const cap = captureSends();
    try {
      await request(app)
        .patch(`/api/v1/admin/orders/${placed.body.orderNumber}/status`)
        .set("Cookie", `${ACCESS_COOKIE}=${adminToken()}`)
        .send({ status: STATUS.PREPARING });

      await new Promise((r) => setTimeout(r, 10));
      expect(cap.sent).toHaveLength(0);
    } finally {
      cap.restore();
    }
  });
});
