/**
 * Central, env-driven configuration. Import this everywhere instead of reading
 * process.env directly. `validate()` returns the list of missing critical vars
 * so server.js can fail fast.
 */
require("dotenv").config();

const bool = (val, fallback) => {
  if (val === undefined || val === null || val === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(val).toLowerCase());
};

const env = process.env.NODE_ENV || "development";

// When true, the app uses in-memory/file data instead of MySQL. Lets CI run the
// integration tests with no database (per the project standard).
const useFileData = bool(process.env.USE_FILE_DATA, false);

const config = {
  env,
  isProduction: env === "production",
  isDevelopment: env !== "production",
  useFileData,

  server: {
    port: Number(process.env.PORT) || 4000,
    allowedOrigins: (process.env.ALLOWED_ORIGINS || "http://localhost:3000")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  },

  db: {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    name: process.env.DB_NAME || "fluffy",
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
    queueLimit: Number(process.env.DB_QUEUE_LIMIT) || 0,
    multipleStatements: bool(process.env.DB_MULTIPLE_STATEMENTS, false),
    ssl: bool(process.env.DB_SSL, false),
    sslCaPath: process.env.DB_SSL_CA || "",
    sslRejectUnauthorized: bool(process.env.DB_SSL_REJECT_UNAUTHORIZED, true),
  },

  auth: {
    googleClientId: process.env.GOOGLE_CLIENT_ID || "",
    googleVerifyTimeoutMs: Number(process.env.GOOGLE_VERIFY_TIMEOUT_MS) || 8000,
    jwtSecret: process.env.JWT_SECRET || "",
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
    // Pinned explicitly on both sign and verify. Letting the token's own `alg`
    // header choose is how "alg: none" forgeries work.
    jwtAlgorithm: "HS256",
    jwtIssuer: process.env.JWT_ISSUER || "fluffy-api",
    jwtAudience: process.env.JWT_AUDIENCE || "fluffy-storefront",
  },

  logging: {
    level: process.env.LOG_LEVEL || (env === "production" ? "info" : "debug"),
    console: bool(process.env.LOG_CONSOLE, env !== "production"),
  },
};

/** Return the list of missing critical env vars (empty array = ok to start). */
config.validate = () => {
  const missing = [];
  if (!config.auth.jwtSecret) missing.push("JWT_SECRET");
  // 32 bytes is the standard's floor. A short secret is brute-forceable
  // offline from a single captured token, so treat it as a missing one.
  else if (config.auth.jwtSecret.length < 32) missing.push("JWT_SECRET (must be at least 32 characters)");
  if (!config.auth.googleClientId) missing.push("GOOGLE_CLIENT_ID");
  // DB creds only matter when actually using the DB.
  if (!config.useFileData) {
    if (!config.db.host) missing.push("DB_HOST");
    if (!config.db.name) missing.push("DB_NAME");
  }
  return missing;
};

module.exports = config;
