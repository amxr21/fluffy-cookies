/**
 * JWT verification hardening.
 *
 * `jwt.verify(token, secret)` with no options honours the token's OWN `alg`
 * header. That is the whole family of algorithm-confusion forgeries: re-sign
 * with "none", or hand an HMAC verifier a token claiming RS256 so the public
 * key gets used as the shared secret.
 *
 * These drive the middleware directly rather than over HTTP, because the point
 * is which tokens verify at all — not what any particular route does after.
 */
const jwt = require("jsonwebtoken");

const config = require("../config");
const { requireAuth, optionalAuth } = require("../middleware/auth");

const SECRET = config.auth.jwtSecret;

const CLAIMS = { id: 1, email: "customer@example.test", role: "customer" };

/** Run a middleware with a Bearer token and report what happened. */
function run(middleware, token) {
  return new Promise((resolve) => {
    const req = { headers: token ? { authorization: `Bearer ${token}` } : {} };
    middleware(req, {}, (err) =>
      resolve({ error: err || null, user: req.user || null })
    );
  });
}

/** A token the app itself would issue. */
const validToken = () =>
  jwt.sign(CLAIMS, SECRET, {
    algorithm: config.auth.jwtAlgorithm,
    expiresIn: config.auth.jwtExpiresIn,
    issuer: config.auth.jwtIssuer,
    audience: config.auth.jwtAudience,
  });

describe("a properly issued token", () => {
  it("is accepted", async () => {
    const { error, user } = await run(requireAuth, validToken());

    expect(error).toBeNull();
    expect(user).toMatchObject({ id: 1, role: "customer" });
  });
});

describe("algorithm confusion", () => {
  it('rejects a token re-signed with "none"', async () => {
    // The classic forgery: strip the signature and claim no algorithm.
    const forged = jwt.sign(CLAIMS, "", {
      algorithm: "none",
      issuer: config.auth.jwtIssuer,
      audience: config.auth.jwtAudience,
    });

    const { error, user } = await run(requireAuth, forged);

    expect(error).toBeTruthy();
    expect(error.status).toBe(401);
    expect(user).toBeNull();
  });

  it("rejects a token signed with a different HMAC strength", async () => {
    // HS512 is a legitimate algorithm, but not OURS — accepting it widens what
    // a stolen or mis-issued token can be forged with.
    const forged = jwt.sign(CLAIMS, SECRET, {
      algorithm: "HS512",
      issuer: config.auth.jwtIssuer,
      audience: config.auth.jwtAudience,
    });

    const { error } = await run(requireAuth, forged);
    expect(error).toBeTruthy();
    expect(error.status).toBe(401);
  });
});

describe("claim checks", () => {
  it("rejects a token minted for another audience", async () => {
    const other = jwt.sign(CLAIMS, SECRET, {
      algorithm: config.auth.jwtAlgorithm,
      issuer: config.auth.jwtIssuer,
      audience: "some-other-app",
    });

    const { error } = await run(requireAuth, other);
    expect(error).toBeTruthy();
    expect(error.status).toBe(401);
  });

  it("rejects a token from another issuer", async () => {
    const other = jwt.sign(CLAIMS, SECRET, {
      algorithm: config.auth.jwtAlgorithm,
      issuer: "not-fluffy",
      audience: config.auth.jwtAudience,
    });

    const { error } = await run(requireAuth, other);
    expect(error).toBeTruthy();
  });

  it("rejects an expired token", async () => {
    const expired = jwt.sign(CLAIMS, SECRET, {
      algorithm: config.auth.jwtAlgorithm,
      issuer: config.auth.jwtIssuer,
      audience: config.auth.jwtAudience,
      expiresIn: "-1s",
    });

    const { error } = await run(requireAuth, expired);
    expect(error).toBeTruthy();
    expect(error.status).toBe(401);
  });

  it("rejects a token signed with the wrong secret", async () => {
    const wrong = jwt.sign(CLAIMS, "a-different-secret-of-sufficient-length-32", {
      algorithm: config.auth.jwtAlgorithm,
      issuer: config.auth.jwtIssuer,
      audience: config.auth.jwtAudience,
    });

    const { error } = await run(requireAuth, wrong);
    expect(error).toBeTruthy();
  });
});

describe("optionalAuth", () => {
  it("attaches the user for a valid token", async () => {
    const { error, user } = await run(optionalAuth, validToken());

    expect(error).toBeNull();
    expect(user).toMatchObject({ id: 1 });
  });

  it("treats a forged token as a guest rather than trusting it", async () => {
    // The dangerous failure here is silently ACCEPTING the forgery, not
    // rejecting the request — checkout is meant to work for guests.
    const forged = jwt.sign(CLAIMS, "", { algorithm: "none" });

    const { error, user } = await run(optionalAuth, forged);

    expect(error).toBeNull();
    expect(user).toBeNull();
  });

  it("treats a missing token as a guest", async () => {
    const { error, user } = await run(optionalAuth, null);

    expect(error).toBeNull();
    expect(user).toBeNull();
  });
});

describe("the signing secret", () => {
  it("is long enough that a captured token cannot be brute-forced offline", () => {
    expect(SECRET.length).toBeGreaterThanOrEqual(32);
  });

  it("is rejected at boot when too short", () => {
    const original = config.auth.jwtSecret;
    try {
      config.auth.jwtSecret = "short";
      expect(config.validate().join(" ")).toMatch(/JWT_SECRET/);
    } finally {
      config.auth.jwtSecret = original;
    }
  });
});
