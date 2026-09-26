/**
 * The health endpoint, as an uptime monitor consumes it.
 *
 * A monitor is only as useful as what this returns. `status` alone says up or
 * down; the release says WHICH deploy is up, and the latency moves before
 * anything actually fails — which is the difference between an alert you can
 * act on and one you can only acknowledge.
 */
const request = require("supertest");

const createApp = require("../app");

const app = createApp({ rateLimit: false });

describe("GET /health", () => {
  it("answers 200 when the database is reachable", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("reports how long the database took", async () => {
    // The early warning: this climbs before anything fails outright.
    const res = await request(app).get("/health");

    expect(typeof res.body.dbLatencyMs).toBe("number");
    expect(res.body.dbLatencyMs).toBeGreaterThanOrEqual(0);
  });

  it("names the running release", async () => {
    // Without it, "when did this start" is unanswerable at 3am.
    const res = await request(app).get("/health");
    expect(res.body.release).toBeTruthy();
  });

  it("reports uptime, which distinguishes a crash loop from a steady outage", async () => {
    const res = await request(app).get("/health");

    expect(typeof res.body.uptimeSeconds).toBe("number");
    expect(res.body.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it("needs no credentials", async () => {
    // A monitor should not carry a secret to check whether a site is up.
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
  });

  it("stays unversioned, so a monitor survives an API version bump", async () => {
    const versioned = await request(app).get("/api/v1/health");
    expect(versioned.status).toBe(404);

    const root = await request(app).get("/health");
    expect(root.status).toBe(200);
  });

  it("leaks nothing an attacker can use", async () => {
    const res = await request(app).get("/health");

    // Our own release is fine to expose. Dependency versions, table counts and
    // connection strings are not.
    expect(Object.keys(res.body).sort()).toEqual([
      "db",
      "dbLatencyMs",
      "release",
      "status",
      "uptimeSeconds",
    ]);
  });

  it("is excluded from rate limiting, so a monitor cannot lock itself out", async () => {
    const limited = createApp({ rateLimit: true });

    // Well past any per-window budget a monitor would use.
    for (let i = 0; i < 40; i += 1) {
      const res = await request(limited).get("/health");
      expect(res.status).toBe(200);
    }
  });
});
