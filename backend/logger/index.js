/**
 * Winston logger with daily-rotating files + optional console. Channels:
 *   logger.info/warn/error(...)  — general app log
 *   logger.db(level, msg, meta)  — DB channel (query failures)
 */
const path = require("path");
const winston = require("winston");
require("winston-daily-rotate-file");

const config = require("../config");

const logDir = path.join(process.cwd(), "logs");

const fileTransport = (filename) =>
  new winston.transports.DailyRotateFile({
    dirname: logDir,
    filename: `${filename}-%DATE%.log`,
    datePattern: "YYYY-MM-DD",
    maxSize: "20m",
    maxFiles: "14d",
    zippedArchive: false,
  });

const base = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [fileTransport("app")],
});

if (config.logging.console) {
  base.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

// Separate DB channel.
const dbLogger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [fileTransport("db")],
});

base.db = (level, message, meta) => dbLogger.log(level, message, meta);

module.exports = base;
