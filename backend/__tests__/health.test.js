const request = require("supertest");

const createApp = require("../app");

/**
 * Smoke tests for the API's own contract — the routes that must work for
 * anything else to be reachable.
 *
 * Runs with USE_FILE_DATA=true (set in the CI job and below), so it needs no
 * MySQL. That is the whole purpose of the repository seam in repo.js: the same
 * controllers run against an in-memory store, so integration tests are viable
 * in CI without a database service.
 *
 * `createApp()` returns the app WITHOUT binding a port, so supertest drives it
 * directly — no listener, no port conflicts, no cleanup.
 */

// USE_FILE_DATA, LOG_CONSOLE and the secrets are set in vitest.config.mjs's
// `env` block — they must land before config/index.js is imported, which is
// earlier than any statement in this file runs.

// Rate limiting off: the limiter counts per-IP, and every test here shares one,
// so a long suite would start getting 429s for reasons unrelated to the code.
const app = createApp({ rateLimit: false });

describe("service endpoints", () => {
  it("GET /health reports ok", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    // "file" rather than "up" confirms the test really is running against the
    // in-memory store, not accidentally against someone's local database.
    expect(res.body.db).toBe("file");
  });

  it("GET / identifies the service", async () => {
    const res = await request(app).get("/");

    expect(res.status).toBe(200);
    expect(res.body.service).toBe("fluffy-backend");
  });

  it("an unknown route returns a 404 in the standard error shape", async () => {
    const res = await request(app).get("/no-such-route");

    expect(res.status).toBe(404);
    // Every failure in this API is { error: { message, code } }. The frontend's
    // safeFetch parses exactly this shape, so a route that answers differently
    // breaks error handling everywhere at once.
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(typeof res.body.error.message).toBe("string");
  });
});

describe("authentication is required where it should be", () => {
  // The single highest-value assertion in the suite: a protected route that
  // silently stops being protected is the #1 API vulnerability, and it is
  // invisible in manual testing because the happy path still works.
  it.each([
    ["GET", "/api/v1/cart/1"],
    ["GET", "/api/v1/likes/1"],
    ["GET", "/api/v1/orders/user/1"],
  ])("%s %s rejects an unauthenticated caller", async (method, path) => {
    const res = await request(app)[method.toLowerCase()](path);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("POST /cart rejects an unauthenticated caller", async () => {
    const res = await request(app).post("/api/v1/cart").send({ product_id: 1, quantity: 1 });

    expect(res.status).toBe(401);
  });
});

describe("public endpoints stay public", () => {
  it("GET /products needs no token", async () => {
    const res = await request(app).get("/api/v1/products");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
