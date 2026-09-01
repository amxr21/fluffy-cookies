/**
 * 404 + centralized error handling. Turns ANY error into a consistent JSON
 * shape and logs it with request context. Internal/unknown errors are masked
 * as a generic 500 (full detail still logged).
 *
 *   { error: { message, code, details? } }
 */
const logger = require("../logger");
const config = require("../config");
const { AppError, notFound } = require("../errors/AppError");

const notFoundHandler = (req, _res, next) => {
  next(notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

// Express identifies an error handler by its 4-argument signature — `_next`
// must stay even though it is unused.
const errorHandler = (err, req, res, _next) => {
  const isApp = err instanceof AppError;
  const status = isApp ? err.status : 500;
  const code = isApp ? err.code : "INTERNAL_ERROR";
  const clientMessage =
    isApp && err.isOperational ? err.message : "Something went wrong";
  const details = isApp ? err.details : undefined;

  logger[status >= 500 ? "error" : "warn"](err.message || "Unhandled error", {
    code,
    status,
    method: req.method,
    route: req.originalUrl,
    userId: req.user?.id,
    ip: req.ip,
    stack: err.stack,
    details,
  });

  const payload = { error: { message: clientMessage, code, ...(details ? { details } : {}) } };
  if (config.isDevelopment && !(isApp && err.isOperational)) {
    payload.error.stack = err.stack;
  }
  res.status(status).json(payload);
};

module.exports = { notFoundHandler, errorHandler };
