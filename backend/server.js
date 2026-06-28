const config = require("./config");
const logger = require("./logger");
const createApp = require("./app");

// Fail fast on missing critical configuration.
const missing = config.validate();
if (missing.length) {
  logger.error("Missing required environment variables", { missing });
  process.exit(1);
}

const app = createApp();

const server = app.listen(config.server.port, () => {
  logger.info(`Fluffy backend listening on port ${config.server.port}`, { env: config.env });
});

// Graceful shutdown.
const shutdown = (signal) => {
  logger.info(`${signal} received — shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection", { reason: String(reason) });
});

module.exports = app;
