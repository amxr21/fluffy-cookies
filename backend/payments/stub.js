/**
 * Stub payment adapter — the default when no provider is configured.
 *
 * Lets the whole payment path run in development and CI: intents, webhooks,
 * idempotency, refunds, all of it, with no account and no card ever charged.
 *
 * It deliberately mirrors Stripe's webhook signature scheme rather than
 * accepting anything. A stub that skips verification would mean the signature
 * check is only ever exercised in production, which is the one place you cannot
 * afford to find out it is wrong.
 */
const crypto = require("crypto");

const config = require("../config");
const { badRequest } = require("../errors/AppError");

async function createIntent({ order }) {
  return {
    // Prefixed so a stub reference is unmistakable in a log or a database row.
    providerRef: `stub_pi_${crypto.randomBytes(12).toString("hex")}`,
    clientSecret: `stub_secret_${crypto.randomBytes(12).toString("hex")}`,
    status: "requires_payment_method",
    amountMinor: order.totalMinor,
  };
}

async function capture(providerRef) {
  return { providerRef, status: "succeeded" };
}

async function refund({ providerRef, amountMinor }) {
  return {
    providerRef: `stub_re_${crypto.randomBytes(8).toString("hex")}`,
    status: "succeeded",
    amountMinor,
    originalRef: providerRef,
  };
}

/** Same scheme as the Stripe adapter, so the real path is under test. */
function verifyWebhook({ payload, signature }) {
  const secret = config.payments.webhookSecret || "stub-webhook-secret";
  if (!signature) throw badRequest("Missing webhook signature");

  const parts = Object.fromEntries(
    String(signature)
      .split(",")
      .map((p) => p.split("=", 2))
      .filter((p) => p.length === 2)
  );
  if (!parts.t || !parts.v1) throw badRequest("Malformed webhook signature");

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(parts.t));
  if (!Number.isFinite(ageSeconds) || ageSeconds > config.payments.webhookToleranceSeconds) {
    throw badRequest("Webhook timestamp is outside the tolerance window");
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${parts.t}.${payload}`, "utf8")
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(parts.v1, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw badRequest("Webhook signature does not match");
  }

  const event = JSON.parse(payload);
  return { id: event.id, type: event.type, data: event.data?.object ?? {} };
}

/** Build a correctly signed payload — for tests and local webhook replay. */
function signPayload(payload, secret = config.payments.webhookSecret || "stub-webhook-secret") {
  const t = Math.floor(Date.now() / 1000);
  const v1 = crypto.createHmac("sha256", secret).update(`${t}.${payload}`, "utf8").digest("hex");
  return `t=${t},v1=${v1}`;
}

module.exports = { name: "stub", createIntent, capture, refund, verifyWebhook, signPayload };
