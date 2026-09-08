/**
 * Express application factory. Builds and returns the app WITHOUT binding a
 * port, so tests can import it (supertest) without starting a server.
 */
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");

const config = require("./config");
const { ping } = require("./dbClient");
const requestId = require("./middleware/requestId");
const logger = require("./logger");
const requestLogger = require("./middleware/requestLogger");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

const authRoutes = require("./routes/authRoutes");
const productsRoutes = require("./routes/productsRoutes");
const cartRoutes = require("./routes/cartRoutes");
const ordersRoutes = require("./routes/ordersRoutes");
const likesRoutes = require("./routes/likesRoutes");
const adminRoutes = require("./routes/adminRoutes");

function createApp({ rateLimit: enableRateLimit = true } = {}) {
  const app = express();
  app.set("trust proxy", 1);

  // First in the chain: everything downstream (rate-limit rejections, CORS
  // failures, request logs, errors) should be traceable by the same id.
  app.use(requestId);

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

  // Order tracking takes no auth, by design — a gift recipient can follow an
  // order without an account. That also makes it the one endpoint an attacker
  // can walk to enumerate orders, so it gets its own tighter budget. A real
  // customer refreshes a handful of times; 30 lookups per 15 minutes is far
  // more than that and far less than a scraping run needs.
  const trackLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: {
        message: "Too many tracking lookups, please try again later.",
        code: "RATE_LIMITED",
      },
    },
  });

  if (enableRateLimit) app.use(generalLimiter);
  app.use(express.json());
  // Auth tokens travel as httpOnly cookies (lib/tokens.js), so they must be
  // parsed before any route that reads req.user.
  app.use(cookieParser());
  app.use(requestLogger);

  /**
   * Health check, for an uptime monitor.
   *
   * Answers three things a monitor needs and a human reading an alert wants:
   * whether the database is reachable, how long that took, and which release
   * is running. Without the release, "when did this start" is unanswerable at
   * 3am; without the duration, a database that is up but crawling looks
   * identical to a healthy one.
   *
   * Deliberately unauthenticated and unversioned: a monitor should not carry
   * credentials, and it should not have to follow an API version bump. It
   * exposes nothing an attacker can use — no counts, no versions of anything
   * but our own release.
   */
  app.get("/health", async (_req, res) => {
    const startedAt = Date.now();
    try {
      await ping();
      res.json({
        status: "ok",
        db: config.useFileData ? "file" : "up",
        dbLatencyMs: Date.now() - startedAt,
        release: config.sentry.release || "unknown",
        uptimeSeconds: Math.round(process.uptime()),
      });
    } catch (err) {
      // 503 rather than 500: this is "temporarily unable to serve", which is
      // what a monitor and a load balancer both need to see to back off.
      logger.error("health.db_unreachable", { message: err?.message });
      res.status(503).json({
        status: "degraded",
        db: "down",
        release: config.sentry.release || "unknown",
      });
    }
  });
  // /health and / stay unversioned: they describe the deployment, not the API
  // contract, and an uptime monitor should not have to follow a version bump.
  app.get("/", (_req, res) =>
    res.json({ status: "ok", service: "fluffy-backend", apiVersion: "v1", api: "/api/v1" })
  );

  // Feature routes, all under /api/v1.
  //
  // Versioned from the start so a breaking change becomes /api/v2 rather than a
  // silent shape change under a client's feet. Retrofitting this onto a live API
  // means either breaking clients or running a long migration.
  const v1 = express.Router();
  v1.use("/products", productsRoutes);
  v1.use("/cart", cartRoutes);
  v1.use("/orders", ordersRoutes);
  v1.use("/likes", likesRoutes);
  v1.use("/admin", adminRoutes);
  // Discount checking is a guessing oracle if it is fast and unlimited: try
  // codes until one works. B10.4 names this directly. The generic message from
  // lib/discounts.js is the other half of the defence.
  const discountLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: {
        message: "Too many code attempts, please try again later.",
        code: "RATE_LIMITED",
      },
    },
  });

  if (enableRateLimit) {
    v1.use("/auth", authLimiter);
    v1.use("/orders/track", trackLimiter);
    v1.use("/orders/discount", discountLimiter);
  }
  v1.use("/", authRoutes);

  app.use("/api/v1", v1);

  // 404 + central error handler — must come after all routes.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
