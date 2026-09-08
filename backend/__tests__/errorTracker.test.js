/**
 * Error tracking.
 *
 * The rule under test is B1's split: expected failures are logged, bugs are
 * reported. Burying real incidents under 404 noise is how alerting dies — an
 * inbox with four thousand "order not found" events is an inbox nobody opens,
 * and the one genuine 500 in there goes unseen.
 */
const request = require("supertest");

const createApp = require("../app");
const errorTracker = require("../lib/errorTracker");
const {
  AppError,
  notFound,
  badRequest,
  forbidden,
  conflict,
  validation,
  internal,
} = require("../errors/AppError");

const app = createApp({ rateLimit: false });

describe("deciding what is worth reporting", () => {
  it("treats a plain Error as a bug", () => {
    expect(errorTracker.isUnexpected(new Error("boom"))).toBe(true);
    expect(errorTracker.isUnexpected(new TypeError("bad type"))).toBe(true);
  });

  it("treats every expected failure as not worth reporting", () => {
    // These are the ones that would drown the inbox.
    for (const err of [
      notFound("Order not found"),
      badRequest("Unknown product"),
      forbidden("Admin access required"),
      conflict("Already ready"),
      validation("Validation failed"),
    ]) {
      expect(errorTracker.isUnexpected(err)).toBe(false);
    }
  });

  it("reports a 500 even though it is an AppError", () => {
    // `internal` is an AppError but represents a bug, so it must still reach
    // the tracker — the test that would fail if the split keyed on the class
    // alone rather than on isOperational.
    const err = internal("Something went wrong");
    err.isOperational = false;
    expect(errorTracker.isUnexpected(err)).toBe(true);
  });

  it("reports an AppError subclass that is not operational", () => {
    const err = new AppError("weird", { status: 500 });
    err.isOperational = false;
    expect(errorTracker.isUnexpected(err)).toBe(true);
  });
});

describe("capture", () => {
  it("skips an operational error without needing a client", () => {
    expect(errorTracker.capture(notFound("nope"))).toMatchObject({
      sent: false,
      reason: "OPERATIONAL",
    });
  });

  it("reports being disabled rather than pretending to send", () => {
    // No DSN in test, so this is the honest answer.
    expect(errorTracker.capture(new Error("boom"))).toMatchObject({
      sent: false,
      reason: "DISABLED",
    });
  });

  it("never throws, whatever it is handed", () => {
    // A failure in the reporter must not become a second failure in the
    // request that was already failing.
    expect(() => errorTracker.capture(null)).not.toThrow();
    expect(() => errorTracker.capture(undefined)).not.toThrow();
    expect(() => errorTracker.capture("a string")).not.toThrow();
    expect(() => errorTracker.capture({ message: "not an error" })).not.toThrow();
  });
});

describe("init", () => {
  it("is a no-op with no DSN, so development needs no account", () => {
    expect(() => errorTracker.init()).not.toThrow();
  });
});

describe("through a real request", () => {
  it("still answers the customer when tracking is off", async () => {
    const res = await request(app).get("/api/v1/orders/track/FLZZZZZZZZ");

    expect(res.status).toBe(404);
    expect(res.body.error.requestId).toBeTruthy();
  });

  it("keeps the requestId on the response, which is what ties it to a report", async () => {
    const res = await request(app).get("/definitely-not-a-route");

    expect(res.headers["x-request-id"]).toBeTruthy();
    expect(res.body.error.requestId).toBe(res.headers["x-request-id"]);
  });
});
