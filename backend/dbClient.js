/**
 * Database access helpers (wrap the pool in ./db.js). Everything that touches
 * MySQL goes through `query` / `withTransaction` so failures are logged and
 * mysql2 errors are mapped to client-safe AppErrors. Always use parameterized
 * queries (`?`) — these helpers cannot sanitize interpolated SQL.
 *
 * When USE_FILE_DATA is on there is no pool; callers should use the `repo`
 * layer instead of `query`. `ping` still resolves so /health works.
 */
const pool = require("./db");
const logger = require("./logger");
const config = require("./config");
const { conflict, badRequest, serviceUnavailable } = require("./errors/AppError");

const mapDbError = (err, context) => {
  logger.db("error", "query failed", {
    code: err.code,
    errno: err.errno,
    sqlState: err.sqlState,
    sqlMessage: err.sqlMessage,
    op: context?.op,
  });
  switch (err.code) {
    case "ER_DUP_ENTRY":
      return conflict("That record already exists");
    case "ER_NO_REFERENCED_ROW":
    case "ER_NO_REFERENCED_ROW_2":
      return badRequest("Referenced record does not exist");
    case "ER_ROW_IS_REFERENCED":
    case "ER_ROW_IS_REFERENCED_2":
      return conflict("That record is still referenced by other data");
    default:
      return serviceUnavailable("A database error occurred", err);
  }
};

async function query(sql, params = [], context = {}) {
  if (config.useFileData) {
    throw new Error("query() called while USE_FILE_DATA is on — use the repo layer");
  }
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (err) {
    throw mapDbError(err, { ...context, sql });
  }
}

async function withTransaction(fn) {
  if (config.useFileData) {
    throw new Error("withTransaction() called while USE_FILE_DATA is on");
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const txQuery = async (sql, params = [], context = {}) => {
      try {
        const [rows] = await conn.execute(sql, params);
        return rows;
      } catch (err) {
        throw mapDbError(err, { ...context, sql });
      }
    };
    const result = await fn(txQuery);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function ping() {
  if (config.useFileData) return true;
  const conn = await pool.getConnection();
  try {
    await conn.ping();
    return true;
  } finally {
    conn.release();
  }
}

module.exports = { query, withTransaction, ping };
