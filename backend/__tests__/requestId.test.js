/**
 * requestId correlation.
 *
 * Every response carries `x-request-id`, and every error envelope repeats it,
 * so a customer-reported failure can be found in the logs by that one string.
 */
const request = require("supertest");

const createApp = require("../app");

const app = createApp({ rateLimit: false });

// RFC 4122 v4, as produced by crypto.randomUUID().
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("x-request-id header", () => {
  it("is set on a successful response", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["x-request-id"]).toMatch(UUID_V4);
  });

  it("is set on an error response", async () => {
    const res = await request(app).get("/definitely-not-a-route");
    expect(res.status).toBe(404);
    expect(res.headers["x-request-id"]).toMatch(UUID_V4);
  });

  it("differs between requests", async () => {
    const [a, b] = await Promise.all([
      request(app).get("/health"),
      request(app).get("/health"),
    ]);
    expect(a.headers["x-request-id"]).not.toBe(b.headers["x-request-id"]);
  });
});

describe("inbound x-request-id", () => {
  it("is honoured so a trace survives a proxy", async () => {
    const res = await request(app)
      .get("/health")
      .set("x-request-id", "upstream-trace-123");
    expect(res.headers["x-request-id"]).toBe("upstream-trace-123");
  });

  it("caps an over-long id rather than writing it to the logs verbatim", async () => {
    const res = await request(app).get("/health").set("x-request-id", "a".repeat(500));
    expect(res.headers["x-request-id"]).toHaveLength(64);
  });

  it("falls back to a generated id when the inbound value is entirely unsafe", async () => {
    const res = await request(app).get("/health").set("x-request-id", "!!!@@@###");
    expect(res.headers["x-request-id"]).toMatch(UUID_V4);
  });
});

describe("sanitising an inbound id", () => {
  // Exercised directly rather than over the wire: Node's HTTP client refuses to
  // SEND a header containing CRLF, so a supertest request can never deliver the
  // payload this guard exists to neutralise. A proxy or a non-Node caller can.
  const requestId = require("../middleware/requestId");

  /** Drive the middleware with a fake req/res and return the id it assigned. */
  const idFor = (inbound) => {
    const req = { headers: inbound === undefined ? {} : { "x-request-id": inbound } };
    const res = { setHeader: () => {} };
    requestId(req, res, () => {});
    return req.id;
  };

  it("strips CRLF so a forged header or log line cannot be injected", () => {
    const id = idFor("abc\r\nX-Injected: evil");
    expect(id).not.toMatch(/[\r\n]/);
    expect(id).toBe("abcX-Injectedevil");
  });

  it("strips spaces and quotes that would break a JSON log line", () => {
    expect(idFor('a "b" c')).toBe("abc");
  });

  it("keeps the safe id characters untouched", () => {
    expect(idFor("trace-id_v2.1")).toBe("trace-id_v2.1");
  });

  it("generates an id when the header is absent", () => {
    expect(idFor(undefined)).toMatch(UUID_V4);
  });

  it("ignores a non-string header value", () => {
    // Duplicated headers arrive as an array — must not throw or stringify.
    expect(idFor(["a", "b"])).toMatch(UUID_V4);
  });
});

describe("error envelope", () => {
  it("carries the same requestId as the header", async () => {
    const res = await request(app).get("/nope");

    expect(res.body.error).toBeDefined();
    expect(res.body.error.requestId).toBe(res.headers["x-request-id"]);
  });

  it("keeps message and code alongside it", async () => {
    const res = await request(app).get("/nope");

    expect(res.body.error).toMatchObject({
      code: "NOT_FOUND",
      message: expect.any(String),
      requestId: expect.any(String),
    });
  });

  it("includes it on a validation failure too", async () => {
    // Empty body fails the zod schema — a 422 from a different code path than
    // the 404 above, and it must be just as traceable.
    const res = await request(app).post("/api/v1/auth").send({});

    expect(res.status).toBe(422);
    expect(res.body.error.requestId).toBe(res.headers["x-request-id"]);
  });
});
