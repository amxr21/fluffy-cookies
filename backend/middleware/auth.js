/**
 * JWT authentication. Verifies the Bearer token issued at login and attaches
 * req.user. Protected routes derive the user from the *token*, never from a
 * client-supplied id. requireAdmin re-checks the role against the data store so
 * a demoted user can't keep access via an old token.
 */
const jwt = require("jsonwebtoken");
const config = require("../config");
const { findUserById } = require("../repo");
const { unauthorized, forbidden } = require("../errors/AppError");
const { ACCESS_COOKIE } = require("../lib/tokens");

/**
 * Read the access token from the httpOnly cookie, falling back to the
 * Authorization header.
 *
 * The header path is kept for non-browser callers (a future admin dashboard,
 * scripts, tests) — those are not subject to CSRF because nothing sends the
 * header automatically. Browsers use the cookie, which no script can read.
 */
function readAccessToken(req) {
  const fromCookie = req.cookies?.[ACCESS_COOKIE];
  if (fromCookie) return fromCookie;

  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

/**
 * Pin the algorithm and check the claims on every verify.
 *
 * Without `algorithms`, jsonwebtoken honours the token's own `alg` header — the
 * classic forgery is to re-sign with "none", or to hand an HMAC a token claiming
 * RS256 so the public key is used as the shared secret. Issuer and audience are
 * checked so a token minted for another service cannot be replayed here.
 */
const VERIFY_OPTIONS = {
  algorithms: [config.auth.jwtAlgorithm],
  issuer: config.auth.jwtIssuer,
  audience: config.auth.jwtAudience,
};

const requireAuth = (req, _res, next) => {
  const token = readAccessToken(req);
  if (!token) return next(unauthorized("Authentication required"));
  try {
    const payload = jwt.verify(token, config.auth.jwtSecret, VERIFY_OPTIONS);
    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role || "customer",
      tokenVersion: payload.tv ?? 0,
    };
    return next();
  } catch {
    return next(unauthorized("Your session has expired. Please sign in again."));
  }
};

/**
 * Reject an access token issued before the user's last "sign out everywhere".
 *
 * Access tokens are stateless, so revoking sessions alone leaves them working
 * until expiry. Comparing the token's `tv` claim against the stored
 * token_version is what closes that window — at the cost of one lookup, so it
 * is applied only where a stale token would actually matter.
 */
const requireFreshToken = (req, _res, next) => {
  requireAuth(req, _res, async (err) => {
    if (err) return next(err);
    try {
      const user = await findUserById(req.user.id);
      if (!user) return next(unauthorized("Your session has expired. Please sign in again."));
      if ((user.token_version || 0) !== (req.user.tokenVersion || 0)) {
        return next(unauthorized("Your session has expired. Please sign in again."));
      }
      return next();
    } catch (e) {
      return next(e);
    }
  });
};

const requireAdmin = (req, res, next) => {
  requireAuth(req, res, async (err) => {
    if (err) return next(err);
    try {
      const user = await findUserById(req.user.id);
      if (!user || user.role !== "admin") {
        return next(forbidden("Admin access required"));
      }
      req.user.role = "admin";
      return next();
    } catch (e) {
      return next(e);
    }
  });
};

/** Soft auth: attaches req.user if a valid token is present, but never rejects.
 *  Used by routes that work for both guests and signed-in users (e.g. checkout). */
const optionalAuth = (req, _res, next) => {
  const token = readAccessToken(req);
  if (token) {
    try {
      const payload = jwt.verify(token, config.auth.jwtSecret, VERIFY_OPTIONS);
      req.user = { id: payload.id, email: payload.email, role: payload.role || "customer" };
    } catch {
      /* ignore invalid token — treat as guest */
    }
  }
  next();
};

module.exports = requireAuth;
module.exports.requireAuth = requireAuth;
module.exports.requireAdmin = requireAdmin;
module.exports.requireFreshToken = requireFreshToken;
module.exports.optionalAuth = optionalAuth;
