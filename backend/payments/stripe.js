/**
 * Stripe adapter.
 *
 * Uses the REST API over `fetch` rather than the SDK: four calls do not justify
 * a dependency, and the webhook signature check is written out below so what it
 * actually verifies is visible rather than hidden behind a library call.
 *
 * Raw card data never reaches this server. `createIntent` returns a
 * `clientSecret` that the browser hands to Stripe's own hosted fields — the
 * card number goes from the customer to Stripe directly, which is what keeps
 * the whole application out of PCI-DSS scope.
 */
const crypto = require("crypto");

const config = require("../config");
const { badRequest, serviceUnavailable } = require("../errors/AppError");

const API = "https://api.stripe.com/v1";

/** Stripe's API takes form encoding, not JSON. */
const form = (obj) =>
  Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

async function call(path, body) {
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.payments.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form(body),
    });
  } catch (err) {
    // Network failure reaching Stripe is a 503, not a 500: it is temporary and
    // the caller should retry rather than treat the order as broken.
    throw serviceUnavailable("Could not reach the payment provider", err);
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = json?.error?.message || `Stripe returned ${res.status}`;
    throw serviceUnavailable(`Payment provider error: ${message}`);
  }
  return json;
}

/**
 * Create a PaymentIntent for an order.
 *
 * The amount comes from the order we computed server-side, never from the
 * request — the whole point of B6 would be lost if the browser could name the
 * charge here.
 */
async function createIntent({ order }) {
  const intent = await call("/payment_intents", {
    amount: order.totalMinor,
    currency: String(order.currency || "AED").toLowerCase(),
    "automatic_payment_methods[enabled]": "true",
    // Ties the charge back to the order in Stripe's own dashboard, which is
    // where a dispute is investigated.
    "metadata[order_number]": order.orderNumber,
    // Stripe's own idempotency, so a retried createIntent does not create a
    // second charge for one order.
    "metadata[idempotency_scope]": `order:${order.orderNumber}`,
  });

  return {
    providerRef: intent.id,
    clientSecret: intent.client_secret,
    status: intent.status,
  };
}

async function capture(providerRef) {
  const intent = await call(`/payment_intents/${providerRef}/capture`, {});
  return { status: intent.status };
}

async function refund({ providerRef, amountMinor, reason }) {
  const created = await call("/refunds", {
    payment_intent: providerRef,
    amount: amountMinor,
    reason: reason === "requested_by_customer" ? reason : undefined,
  });
  return { providerRef: created.id, status: created.status };
}

/**
 * Verify a webhook signature.
 *
 * Written out rather than delegated so what is checked is visible:
 *
 *  - The signed payload is `timestamp.rawBody`, so a valid signature cannot be
 *    reused with a different body.
 *  - Compared with `timingSafeEqual`, because a byte-by-byte `===` leaks how
 *    much of a forged signature was right through how long the comparison took.
 *  - The timestamp is age-checked, so a captured-and-replayed request from last
 *    week is refused even though its signature is genuine.
 *
 * `payload` must be the RAW body. Parsed-then-restringified JSON will not match
 * — key order and whitespace change the bytes.
 */
function verifyWebhook({ payload, signature }) {
  if (!config.payments.webhookSecret) {
    throw serviceUnavailable("Webhook secret is not configured");
  }
  if (!signature) throw badRequest("Missing webhook signature");

  const parts = Object.fromEntries(
    String(signature)
      .split(",")
      .map((p) => p.split("=", 2))
      .filter((p) => p.length === 2)
  );

  const timestamp = parts.t;
  const provided = parts.v1;
  if (!timestamp || !provided) throw badRequest("Malformed webhook signature");

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > config.payments.webhookToleranceSeconds) {
    throw badRequest("Webhook timestamp is outside the tolerance window");
  }

  const expected = crypto
    .createHmac("sha256", config.payments.webhookSecret)
    .update(`${timestamp}.${payload}`, "utf8")
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  // timingSafeEqual throws on a length mismatch, so check that first — and a
  // wrong length is a wrong signature anyway.
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw badRequest("Webhook signature does not match");
  }

  const event = JSON.parse(payload);
  return { id: event.id, type: event.type, data: event.data?.object ?? {} };
}

module.exports = { name: "stripe", createIntent, capture, refund, verifyWebhook };
