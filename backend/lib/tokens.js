/**
 * Access and refresh tokens.
 *
 * Access token: a short-lived (15m) JWT, verified statelessly on every request.
 * It carries `tv` — the user's token_version — so a role change or a forced
 * sign-out can invalidate it without waiting for expiry.
 *
 * Refresh token: 32 random bytes, stored only as a SHA-256 hash. Rotated on
 * every use. If a token that has already been exchanged comes back, the entire
 * family is revoked: the only way that happens is a copy in someone else's
 * hands, and at that point neither party's session can be trusted.
 *
 * Both travel as httpOnly cookies, so no script can read them — which is the
 * whole reason for moving off localStorage.
 */
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const config = require("../config");

/** Short enough that a leaked access token is briefly useful, not indefinitely. */
const ACCESS_TTL = "15m";

/** How long a session can be refreshed before the user must sign in again. */
const REFRESH_TTL_DAYS = 30;

const ACCESS_COOKIE = "fluffy_at";
const REFRESH_COOKIE = "fluffy_rt";

/** Hash a refresh token for storage. The plaintext never touches the database. */
const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

function signAccessToken({ id, email, role, tokenVersion = 0 }) {
  return jwt.sign({ id, email, role, tv: tokenVersion }, config.auth.jwtSecret, {
    algorithm: config.auth.jwtAlgorithm,
    expiresIn: ACCESS_TTL,
    issuer: config.auth.jwtIssuer,
    audience: config.auth.jwtAudience,
  });
}

function generateRefreshToken() {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  return { token, tokenHash: hashToken(token), expiresAt };
}

/**
 * Cookie options.
 *
 * `sameSite: "lax"` is only correct because the storefront proxies the API
 * through its own origin (next.config.ts rewrites). If the browser ever calls
 * the API cross-site again, Lax silently stops sending the cookie on those
 * requests — the failure looks like "randomly signed out", not like a config
 * error, so change both together or not at all.
 */
function cookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeMs,
  };
}

const accessCookieOptions = () => cookieOptions(15 * 60 * 1000);
const refreshCookieOptions = () =>
  cookieOptions(REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

/** Clearing must use the same attributes the cookie was set with, or it lingers. */
function clearAuthCookies(res) {
  const base = { httpOnly: true, secure: config.isProduction, sameSite: "lax", path: "/" };
  res.clearCookie(ACCESS_COOKIE, base);
  res.clearCookie(REFRESH_COOKIE, base);
}

function setAuthCookies(res, { accessToken, refreshToken }) {
  res.cookie(ACCESS_COOKIE, accessToken, accessCookieOptions());
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
}

module.exports = {
  ACCESS_TTL,
  REFRESH_TTL_DAYS,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  hashToken,
  signAccessToken,
  generateRefreshToken,
  setAuthCookies,
  clearAuthCookies,
  accessCookieOptions,
  refreshCookieOptions,
};
