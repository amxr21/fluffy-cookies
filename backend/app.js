/**
 * Express application factory. Builds and returns the app WITHOUT binding a
 * port, so tests can import it (supertest) without starting a server.
 */
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const config = require("./config");
const { ping } = require("./dbClient");
const requestLogger = require("./middleware/requestLogger");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

const authRoutes = require("./routes/authRoutes");
const productsRoutes = require("./routes/productsRoutes");
const cartRoutes = require("./routes/cartRoutes");
const ordersRoutes = require("./routes/ordersRoutes");
const likesRoutes = require("./routes/likesRoutes");

function createApp({ rateLimit: enableRateLimit = true } = {}) {
  const app = express();
  app.set("trust proxy", 1);

  // JSON API consumed by a separate frontend origin — drop document-oriented CSP/CORP.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));

  app.use(
    cors({
      origin: config.server.allowedOrigins,
      credentials: true,
      methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    })
  );

  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === "/health",
    message: { error: { message: "Too many requests, please try again later.", code: "RATE_LIMITED" } },
  });
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { message: "Too many login attempts, please try again later.", code: "RATE_LIMITED" } },
  });

  if (enableRateLimit) app.use(generalLimiter);
  app.use(express.json());
  app.use(requestLogger);

  app.get("/health", async (_req, res) => {
    try {
      await ping();
      res.json({ status: "ok", db: config.useFileData ? "file" : "up" });
    } catch {
      res.status(503).json({ status: "degraded", db: "down" });
    }
  });
  app.get("/", (_req, res) => res.json({ status: "ok", service: "fluffy-backend" }));

  // Feature routes.
  app.use("/products", productsRoutes);
  app.use("/cart", cartRoutes);
  app.use("/orders", ordersRoutes);
  app.use("/likes", likesRoutes);
  if (enableRateLimit) app.use("/api/auth", authLimiter);
  app.use("/", authRoutes);

  // 404 + central error handler — must come after all routes.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
