/** Google OAuth login: verify id_token, upsert user, issue app JWT. */
const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");

const config = require("../config");
const repo = require("../repo");
const logger = require("../logger");
const { unauthorized, serviceUnavailable } = require("../errors/AppError");

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

  const token = jwt.sign({ id: user.id, email: user.email, role }, config.auth.jwtSecret, {
    algorithm: config.auth.jwtAlgorithm,
    expiresIn: config.auth.jwtExpiresIn,
    issuer: config.auth.jwtIssuer,
    audience: config.auth.jwtAudience,
  });

  res.json({
    success: true,
    token,
    userId: String(user.id),
    name: user.name || name || "",
    picture: user.picture || picture || "",
    role,
  });
};

module.exports = { googleLogin };
