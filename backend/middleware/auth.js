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
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next(unauthorized("Authentication required"));
  try {
    const payload = jwt.verify(token, config.auth.jwtSecret, VERIFY_OPTIONS);
    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role || "customer",
    };
    return next();
  } catch {
    return next(unauthorized("Your session has expired. Please sign in again."));
  }
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
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
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
module.exports.optionalAuth = optionalAuth;
