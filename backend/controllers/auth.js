/** Google OAuth login: verify id_token, upsert user, issue app JWT. */
const { OAuth2Client } = require("google-auth-library");
const { randomUUID } = require("crypto");

const config = require("../config");
const repo = require("../repo");
const logger = require("../logger");
const { unauthorized, serviceUnavailable } = require("../errors/AppError");
const {
  hashToken,
  signAccessToken,
  generateRefreshToken,
  setAuthCookies,
  clearAuthCookies,
  REFRESH_COOKIE,
} = require("../lib/tokens");

/**
 * Issue a fresh access + refresh pair and set them as httpOnly cookies.
 *
 * `familyId` ties every token descended from one login together, so reuse of an
 * already-exchanged token can revoke the whole line rather than just the one
 * token — see `refresh` below.
 */
async function issueSession(res, req, user, familyId = randomUUID()) {
  const { token, tokenHash, expiresAt } = generateRefreshToken();

  await repo.createSession({
    id: randomUUID(),
    userId: user.id,
    tokenHash,
    familyId,
    expiresAt,
    userAgent: (req.get("user-agent") || "").slice(0, 255),
    ip: req.ip,
  });

  const accessToken = signAccessToken({
    id: user.id,
    email: user.email,
    role: user.role || "customer",
    tokenVersion: user.token_version || 0,
  });

  setAuthCookies(res, { accessToken, refreshToken: token });
  return { accessToken, familyId };
}

const client = new OAuth2Client(config.auth.googleClientId);

const verifyWithTimeout = (idToken) =>
  Promise.race([
    client.verifyIdToken({ idToken, audience: config.auth.googleClientId }),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(serviceUnavailable("Google verification timed out")),
        config.auth.googleVerifyTimeoutMs
      )
    ),
  ]);

const googleLogin = async (req, res) => {
  const { id_token } = req.body;

  let payload;
  try {
    const ticket = await verifyWithTimeout(id_token);
    payload = ticket.getPayload();
  } catch (err) {
    if (err && err.status === 503) throw err;
    logger.warn("Google token verification failed", { message: err?.message });
    throw unauthorized("Google login failed");
  }

  const { sub: googleId, email, name, picture } = payload;
  const user = await repo.upsertGoogleUser({ googleId, email, name, picture });
  const role = user.role || "customer";

  await issueSession(res, req, { ...user, role });

  // The token is deliberately NOT in this body any more — it travels as an
  // httpOnly cookie so no script can read it. The rest is display data the
  // client needs for the account menu.
  res.json({
    success: true,
    userId: String(user.id),
    name: user.name || name || "",
    picture: user.picture || picture || "",
    role,
  });
};

/**
 * Exchange a refresh token for a new pair.
 *
 * Rotation with reuse detection: each refresh token works exactly once. A token
 * arriving that was already exchanged means a copy exists somewhere it should
 * not, so the entire family is revoked — the legitimate user is signed out too,
 * which is the correct trade when the alternative is leaving an attacker with a
 * valid session.
 */
const refresh = async (req, res) => {
  const presented = req.cookies?.[REFRESH_COOKIE];
  if (!presented) throw unauthorized("Not signed in");

  const session = await repo.findSessionByTokenHash(hashToken(presented));
  if (!session) {
    clearAuthCookies(res);
    throw unauthorized("Your session has expired. Please sign in again.");
  }

  if (session.usedAt) {
    // Replay. Burn the whole family and force a fresh sign-in.
    await repo.revokeSessionFamily(session.familyId);
    clearAuthCookies(res);
    logger.warn("Refresh token reuse detected — family revoked", {
      userId: session.userId,
      familyId: session.familyId,
      ip: req.ip,
    });
    throw unauthorized("Your session has expired. Please sign in again.");
  }

  if (session.revokedAt || new Date(session.expiresAt) < new Date()) {
    clearAuthCookies(res);
    throw unauthorized("Your session has expired. Please sign in again.");
  }

  const user = await repo.findUserById(session.userId);
  if (!user) {
    clearAuthCookies(res);
    throw unauthorized("Your session has expired. Please sign in again.");
  }

  await repo.markSessionUsed(session.id);
  await issueSession(res, req, user, session.familyId);

  res.json({
    success: true,
    userId: String(user.id),
    name: user.name || "",
    picture: user.picture || "",
    role: user.role || "customer",
  });
};

/** Sign out this device: revoke the session server-side, then clear the cookies. */
const logout = async (req, res) => {
  const presented = req.cookies?.[REFRESH_COOKIE];
  if (presented) {
    const session = await repo.findSessionByTokenHash(hashToken(presented));
    // Revoke the family, not just this token: a "sign out" that leaves a
    // rotated descendant alive has not signed anything out.
    if (session) await repo.revokeSessionFamily(session.familyId);
  }
  clearAuthCookies(res);
  res.json({ success: true });
};

/**
 * Sign out everywhere. Revokes every session AND bumps token_version, which is
 * what invalidates access tokens already issued — they are stateless, so
 * revoking sessions alone would leave them working until they expire.
 */
const logoutAll = async (req, res) => {
  await repo.revokeAllUserSessions(req.user.id);
  await repo.bumpTokenVersion(req.user.id);
  clearAuthCookies(res);
  res.json({ success: true });
};

module.exports = { googleLogin, refresh, logout, logoutAll };
