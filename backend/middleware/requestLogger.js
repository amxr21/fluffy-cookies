/** Structured request/response logging. */
const logger = require("../logger");

module.exports = function requestLogger(req, res, next) {
  const start = Date.now();
  res.on("finish", () => {
    logger.info("request", {
      method: req.method,
      route: req.originalUrl,
      status: res.statusCode,
      ms: Date.now() - start,
      ip: req.ip,
      userId: req.user?.id,
    });
  });
  next();
};
