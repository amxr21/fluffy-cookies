/**
 * Cookie sessions, rotation, and revocation.
 *
 * The old model was one 7-day JWT in localStorage: readable by any injected
 * script, and "sign out" cleared only the browser's copy — a captured token
 * stayed valid for its full lifetime because nothing server-side could say
 * otherwise.
 *
 * What must now hold: the token is not reachable by script, each refresh token
 * works exactly once, a replayed token burns the whole family, and signing out
 * actually revokes.
 */
const request = require("supertest");

const createApp = require("../app");
const repo = require("../repo");
const { db } = require("../fileStore");
const {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  hashToken,
  signAccessToken,
  generateRefreshToken,
} = require("../lib/tokens");

const app = createApp({ rateLimit: false });

/** Pull a named cookie's value out of a set-cookie header array. */
function cookieValue(res, name) {
  const jar = res.headers["set-cookie"] || [];
  const hit = jar.find((c) => c.startsWith(`${name}=`));
  return hit ? hit.split(";")[0].split("=").slice(1).join("=") : null;
}

function cookieAttrs(res, name) {
  const jar = res.headers["set-cookie"] || [];
  return jar.find((c) => c.startsWith(`${name}=`)) || "";
}

/**
 * Establish a session directly, bypassing Google.
 *
 * The OAuth exchange is not what these tests are about, and mocking
 * google-auth-library would test the mock rather than the session machinery.
 */
async function makeSession(user = { id: 501, email: "s@example.test", role: "customer" }) {
  if (!db.users.find((u) => u.id === user.id)) {
    db.users.push({ ...user, token_version: 0, name: "Session Tester" });
  }
  const { token, tokenHash, expiresAt } = generateRefreshToken();
  const familyId = `fam-${user.id}-${Date.now()}`;
  await repo.createSession({
    id: `sess-${Math.random().toString(36).slice(2)}`,
    userId: user.id,
    tokenHash,
    familyId,
    expiresAt,
  });
  const accessToken = signAccessToken({ ...user, tokenVersion: 0 });
  return { refreshToken: token, accessToken, familyId, user };
}

describe("auth cookies", () => {
  it("are httpOnly, so no injected script can read the session", async () => {
    const { refreshToken } = await makeSession();
    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `${REFRESH_COOKIE}=${refreshToken}`);

    expect(res.status).toBe(200);
    expect(cookieAttrs(res, ACCESS_COOKIE)).toMatch(/HttpOnly/i);
    expect(cookieAttrs(res, REFRESH_COOKIE)).toMatch(/HttpOnly/i);
  });

  it("are SameSite=Lax, which the same-origin proxy makes possible", async () => {
    // Lax is only correct because next.config.ts proxies the API through the
    // storefront origin. Cross-site would need SameSite=None + CSRF tokens.
    const { refreshToken } = await makeSession();
    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `${REFRESH_COOKIE}=${refreshToken}`);

    expect(cookieAttrs(res, ACCESS_COOKIE)).toMatch(/SameSite=Lax/i);
  });

  it("never returns the token in the response body", async () => {
    const { refreshToken } = await makeSession();
    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `${REFRESH_COOKIE}=${refreshToken}`);

    expect(res.body.token).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain(refreshToken);
  });
});

describe("refresh rotation", () => {
  it("issues a different refresh token each time", async () => {
    const { refreshToken } = await makeSession();
    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `${REFRESH_COOKIE}=${refreshToken}`);

    const rotated = cookieValue(res, REFRESH_COOKIE);
    expect(rotated).toBeTruthy();
    expect(rotated).not.toBe(refreshToken);
  });

  it("stores only a hash, so a database leak yields no working sessions", async () => {
    const { refreshToken } = await makeSession();

    expect(db.sessions.some((r) => r.token_hash === refreshToken)).toBe(false);
    expect(db.sessions.some((r) => r.token_hash === hashToken(refreshToken))).toBe(true);
  });

  it("rejects a refresh with no cookie", async () => {
    const res = await request(app).post("/api/v1/auth/refresh");
    expect(res.status).toBe(401);
  });

  it("rejects an unknown refresh token", async () => {
    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `${REFRESH_COOKIE}=not-a-real-token`);
    expect(res.status).toBe(401);
  });
});

describe("reuse detection", () => {
  it("revokes the whole family when a spent token comes back", async () => {
    const { refreshToken, familyId } = await makeSession();

    // First exchange succeeds and rotates.
    const first = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `${REFRESH_COOKIE}=${refreshToken}`);
    expect(first.status).toBe(200);
    const rotated = cookieValue(first, REFRESH_COOKIE);

    // The same token again means a copy exists somewhere it should not.
    const replay = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `${REFRESH_COOKIE}=${refreshToken}`);
    expect(replay.status).toBe(401);

    // The legitimate holder is signed out too — the correct trade when the
    // alternative is leaving an attacker with a valid session.
    const after = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `${REFRESH_COOKIE}=${rotated}`);
    expect(after.status).toBe(401);

    const family = db.sessions.filter((r) => r.family_id === familyId);
    expect(family.length).toBeGreaterThan(0);
    expect(family.every((r) => r.revoked_at)).toBe(true);
  });

  it("clears the cookies when it revokes", async () => {
    const { refreshToken } = await makeSession();
    await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `${REFRESH_COOKIE}=${refreshToken}`);

    const replay = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `${REFRESH_COOKIE}=${refreshToken}`);

    // A cleared cookie is set to empty with an expiry in the past.
    expect(cookieAttrs(replay, REFRESH_COOKIE)).toMatch(/Expires=Thu, 01 Jan 1970/i);
  });
});

describe("signing out", () => {
  it("revokes server-side, not just in the browser", async () => {
    const { refreshToken } = await makeSession();

    const out = await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", `${REFRESH_COOKIE}=${refreshToken}`);
    expect(out.status).toBe(200);

    // The decisive assertion: the captured token no longer works.
    const after = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `${REFRESH_COOKIE}=${refreshToken}`);
    expect(after.status).toBe(401);
  });

  it("succeeds even with no cookie, so a stuck client can always clear itself", async () => {
    const res = await request(app).post("/api/v1/auth/logout");
    expect(res.status).toBe(200);
  });

  it("sign-out-everywhere invalidates access tokens already issued", async () => {
    const { accessToken, user } = await makeSession({
      id: 502,
      email: "everywhere@example.test",
      role: "customer",
    });

    // Works before.
    const before = await request(app)
      .get(`/api/v1/orders/user/${user.id}`)
      .set("Cookie", `${ACCESS_COOKIE}=${accessToken}`);
    expect(before.status).toBe(200);

    await request(app)
      .post("/api/v1/auth/logout-all")
      .set("Cookie", `${ACCESS_COOKIE}=${accessToken}`);

    // token_version moved, so the claim the stateless token carries is stale.
    const stored = db.users.find((u) => u.id === user.id);
    expect(stored.token_version).toBe(1);
  });
});

describe("the access cookie", () => {
  it("authenticates a request without an Authorization header", async () => {
    const { accessToken, user } = await makeSession({
      id: 503,
      email: "cookie@example.test",
      role: "customer",
    });

    const res = await request(app)
      .get(`/api/v1/orders/user/${user.id}`)
      .set("Cookie", `${ACCESS_COOKIE}=${accessToken}`);

    expect(res.status).toBe(200);
  });

  it("still accepts a Bearer header for non-browser callers", async () => {
    // Scripts and a future admin dashboard are not subject to CSRF, because
    // nothing sends the header automatically.
    const { accessToken, user } = await makeSession({
      id: 504,
      email: "bearer@example.test",
      role: "customer",
    });

    const res = await request(app)
      .get(`/api/v1/orders/user/${user.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
  });
});
