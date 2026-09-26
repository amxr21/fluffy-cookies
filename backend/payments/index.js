/**
 * Payment provider adapter.
 *
 * B7 asks for an interface rather than SDK calls scattered through the
 * codebase, so swapping PayTabs → Stripe → Telr touches one folder. Four
 * methods, and nothing outside this directory knows which provider is behind
 * them:
 *
 *   createIntent({ order })      → { providerRef, clientSecret, status }
 *   capture(providerRef)         → { status }
 *   refund({ providerRef, amountMinor, reason }) → { providerRef, status }
 *   verifyWebhook({ payload, signature })        → { id, type, data }
 *
 * With no provider configured the stub adapter is used, so the whole payment
 * path — orders, webhooks, refunds, idempotency — runs in development and CI
 * without an account and without a real card ever being charged.
 */
const config = require("../config");
const logger = require("../logger");

const stub = require("./stub");
const stripe = require("./stripe");

function selectAdapter() {
  if (config.payments.provider === "stripe" && config.payments.secretKey) {
    return stripe;
  }

  if (config.payments.provider !== "stub") {
    // Loud, because silently falling back to a stub in production would mean
    // orders marked paid that nobody was ever charged for.
    logger.warn("payments.falling_back_to_stub", {
      configured: config.payments.provider,
      reason: "no secret key configured",
    });
  }

  return stub;
}

const adapter = selectAdapter();

module.exports = {
  adapter,
  name: adapter.name,
  createIntent: (...args) => adapter.createIntent(...args),
  capture: (...args) => adapter.capture(...args),
  refund: (...args) => adapter.refund(...args),
  verifyWebhook: (...args) => adapter.verifyWebhook(...args),
};
