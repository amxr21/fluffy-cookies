/**
 * Error tracking.
 *
 * The rule that matters here is B1's split, and it is the whole reason this is
 * a module rather than a one-line SDK call:
 *
 *   AppError  — an expected failure. A 404, a 403, a rejected discount code.
 *               Logged, never sent to the tracker.
 *   Anything else — a bug. Sent, with a requestId to tie it to the log.
 *
 * Burying real incidents under 404 noise is how alerting dies: an inbox with
 * four thousand "order not found" events is an inbox nobody opens, and the one
 * genuine 500 in there goes unseen.
 *
 * Sentry is loaded lazily and only when a DSN is configured, so the package is
 * optional and development and CI need no account.
 */
const config = require("../config");
const logger = require("../logger");
const { AppError } = require("../errors/AppError");

let client = null;
let initialised = false;

/**
 * Initialise the tracker. Safe to call when no DSN is set — it simply does
 * nothing, which is what development and CI want.
 */
function init() {
  if (initialised) return client;
  initialised = true;

  if (!config.sentry.dsn) {
    logger.info("errorTracker.disabled", { reason: "no DSN configured" });
    return null;
  }

  try {
    // Required lazily: a deployment without tracking should not need the
    // package installed at all.
    const Sentry = require("@sentry/node");

    Sentry.init({
      dsn: config.sentry.dsn,
      environment: config.env,
      release: config.sentry.release,
      tracesSampleRate: config.sentry.tracesSampleRate,

      /**
       * Last line of defence for B10.8. The event should already be clean —
       * we never attach a body — but a stack frame or a breadcrumb can carry
       * one, and a leaked token in an error report is a leaked token.
       */
      beforeSend(event) {
        if (event.request) {
          delete event.request.data;
          delete event.request.cookies;
          if (event.request.headers) {
            delete event.request.headers.authorization;
            delete event.request.headers.cookie;
          }
        }
        return event;
      },
    });

    client = Sentry;
    logger.info("errorTracker.ready", { environment: config.env });
    return client;
  } catch (err) {
    // A missing package or a bad DSN must not stop the server booting. Losing
    // error reporting is bad; refusing to serve customers is worse.
    logger.error("errorTracker.init_failed", { message: err.message });
    return null;
  }
}

/** True when this error is a bug rather than an expected failure. */
const isUnexpected = (err) => !(err instanceof AppError) || !err.isOperational;

/**
 * Report an error, if it is one worth reporting.
 *
 * Never throws — a failure in the reporter must not become a second failure in
 * the request that was already failing.
 */
function capture(err, context = {}) {
  if (!isUnexpected(err)) return { sent: false, reason: "OPERATIONAL" };
  if (!client) return { sent: false, reason: "DISABLED" };

  try {
    client.withScope((scope) => {
      // userId only — no email, no name, no body. B10.8.
      if (context.userId) scope.setUser({ id: String(context.userId) });
      if (context.requestId) scope.setTag("requestId", context.requestId);
      if (context.route) scope.setTag("route", context.route);
      if (context.method) scope.setTag("method", context.method);
      client.captureException(err);
    });
    return { sent: true };
  } catch (reportingError) {
    logger.error("errorTracker.capture_failed", { message: reportingError.message });
    return { sent: false, reason: "CAPTURE_FAILED" };
  }
}

module.exports = { init, capture, isUnexpected };
