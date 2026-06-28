/**
 * MySQL connection pool. Returns null when USE_FILE_DATA is on (no DB in CI).
 * Prefer the helpers in ./dbClient.js over using this pool directly.
 */
const fs = require("fs");
const mysql = require("mysql2/promise");
const config = require("./config");

function buildSslConfig() {
  if (!config.db.ssl) return undefined;
  const ssl = { rejectUnauthorized: config.db.sslRejectUnauthorized };
  if (config.db.sslCaPath) {
    try {
      ssl.ca = fs.readFileSync(config.db.sslCaPath, "utf8");
    } catch (err) {
      throw new Error(`Could not read DB_SSL_CA at "${config.db.sslCaPath}": ${err.message}`);
    }
  }
  return ssl;
}

let pool = null;

if (!config.useFileData) {
  pool = mysql.createPool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.name,
    waitForConnections: true,
    connectionLimit: config.db.connectionLimit,
    queueLimit: config.db.queueLimit,
    decimalNumbers: true,
    multipleStatements: config.db.multipleStatements,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    ssl: buildSslConfig(),
    typeCast: (field, next) => {
      // TINYINT(1) -> boolean
      if (field.type === "TINY" && field.length === 1) {
        return field.string() === "1";
      }
      return next();
    },
  });
}

module.exports = pool;
