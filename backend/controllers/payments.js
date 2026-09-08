/**
 * Payment controllers.
 *
 * Three rules from B7 shape everything here:
 *
 *  - **Webhooks are the source of truth**, not the browser redirect. A customer
 *    who closes the tab after paying must still get their order marked paid.
 *  - **The amount is verified server-side** against the order before anything
 *    is marked paid. A webhook says what the provider charged; whether that
 *    matches what we asked for is our job to check.
 *  - **Handlers are idempotent.** Providers retry and will deliver the same
 *    event twice.
 */
const repo = require("../repo");
const provider = require("../payments");
const logger = require("../logger");
const { notFound, badRequest, conflict, forbidden } = require("../errors/AppError");

/**
 * Start a payment for an existing order.
 *
 * Returns a client secret the browser hands to the provider's hosted fields —
 * raw card data never touches this server, which is what keeps the application
 * out of PCI-DSS scope.
 */
const createIntent = async (req, res) => {
  const { orderNumber } = req.body;

  const order = await repo.getOrderByNumber(orderNumber);
  if (!order) throw notFound("Order not found");

  const summary = await repo.findOrderIdByNumber(orderNumber);

  if (order.payment_status === "paid" || order.paymentStatus === "paid") {
    throw conflict("This order has already been paid");
  }

  // Only the person who placed it may pay for it. A guest order has no owner,
  // so possession of the order number is the only credential there — which is
  // why order numbers are unguessable (migration 004).
  const ownerId = summary?.userId ?? order.user_id ?? null;
  if (ownerId && req.user?.id && String(ownerId) !== String(req.user.id)) {
    throw forbidden("You can only pay for your own order");
  }

  const totalMinor = order.totalMinor ?? order.total_minor;

  const intent = await provider.createIntent({
    order: { orderNumber, totalMinor, currency: order.currency },
  });

  await repo.createPayment({
    orderId: summary.id,
    provider: provider.name,
    providerRef: intent.providerRef,
    amountMinor: totalMinor,
    currency: order.currency,
    status: "pending",
  });

  res.status(201).json({
    clientSecret: intent.clientSecret,
    providerRef: intent.providerRef,
    amountMinor: totalMinor,
    currency: order.currency,
  });
};

/**
 * Provider webhook.
 *
 * Verified, then deduplicated, then acted on — in that order. Verification
 * first because an unverified payload is attacker-controlled and must not even
 * be recorded as seen.
 */
const handleWebhook = async (req, res) => {
  let event;
  try {
    // req.body is a Buffer here: express.raw is mounted for this route, because
    // a parsed-then-restringified body will not match the signature.
    event = provider.verifyWebhook({
      payload: req.body.toString("utf8"),
      signature: req.get("stripe-signature") || req.get("x-webhook-signature"),
    });
  } catch (err) {
    logger.warn("webhook.rejected", { reason: err.message, ip: req.ip });
    throw err;
  }

  // Deduplicate. Providers retry by design; without this a retried "succeeded"
  // marks an order paid twice and a retried refund refunds twice.
  const { isNew } = await repo.claimWebhookEvent({
    eventId: event.id,
    provider: provider.name,
    eventType: event.type,
  });

  if (!isNew) {
    // 200, not an error: a duplicate is the provider working correctly, and a
    // non-2xx would make it retry harder.
    logger.info("webhook.duplicate_ignored", { eventId: event.id, type: event.type });
    return res.json({ received: true, duplicate: true });
  }

  const paymentRef = event.data?.id;
  const payment = paymentRef
    ? await repo.findPaymentByRef(provider.name, paymentRef)
    : null;

  if (!payment) {
    // Acknowledged, not retried: an event for a payment we have no record of is
    // not going to succeed on the fifth attempt either.
    logger.warn("webhook.unknown_payment", { eventId: event.id, paymentRef });
    return res.json({ received: true, matched: false });
  }

  if (event.type === "payment_intent.succeeded" || event.type === "payment.succeeded") {
    // Verify the amount BEFORE marking anything paid. A webhook says what the
    // provider charged; whether that matches what we asked for is our job.
    const charged = event.data?.amount_received ?? event.data?.amount;
    if (charged != null && Number(charged) !== payment.amountMinor) {
      logger.error("webhook.amount_mismatch", {
        eventId: event.id,
        expected: payment.amountMinor,
        charged,
      });
      // 200 so the provider stops retrying — retrying will not fix a mismatch.
      // The error log is what raises this to a human.
      return res.json({ received: true, mismatch: true });
    }

    await repo.markPaymentSucceeded({
      paymentId: payment.id,
      orderId: payment.orderId,
      raw: event.data,
    });
    logger.info("payment.succeeded", {
      paymentId: payment.id,
      orderId: payment.orderId,
    });
  } else if (
    event.type === "payment_intent.payment_failed" ||
    event.type === "payment.failed"
  ) {
    await repo.markPaymentFailed({ paymentId: payment.id, orderId: payment.orderId });
    logger.warn("payment.failed", { paymentId: payment.id, orderId: payment.orderId });
  }

  res.json({ received: true });
};

/**
 * Refund a payment, in whole or part.
 *
 * Bounded by what was actually paid and not already refunded — B10.4 lists
 * refund abuse as its own class, and the arithmetic is the control.
 */
const refundPayment = async (req, res) => {
  const { orderNumber } = req.params;
  const { amountMinor, reason } = req.body;

  const summary = await repo.findOrderIdByNumber(orderNumber);
  if (!summary) throw notFound("Order not found");

  const payments = await repo.getPaymentsForOrder(summary.id);
  const paid = payments.find((p) => p.status === "succeeded");
  if (!paid) throw badRequest("This order has no completed payment to refund");

  const alreadyRefunded = await repo.getRefundedTotal(paid.id);
  const remaining = paid.amountMinor - alreadyRefunded;

  const amount = amountMinor ?? remaining;
  if (amount <= 0) throw badRequest("Refund amount must be greater than zero");
  if (amount > remaining) {
    throw badRequest(
      `Cannot refund more than remains. Paid ${paid.amountMinor}, already refunded ${alreadyRefunded}, remaining ${remaining}.`
    );
  }

  const result = await provider.refund({
    providerRef: paid.providerRef,
    amountMinor: amount,
    reason,
  });

  const refund = await repo.createRefund({
    paymentId: paid.id,
    amountMinor: amount,
    reason,
    providerRef: result.providerRef,
    // A refund is not "done" until the provider confirms; the provider's own
    // status is what we record rather than assuming success.
    status: result.status === "succeeded" ? "succeeded" : "pending",
    actorId: req.user.id,
  });

  logger.info("refund.created", {
    orderNumber,
    paymentId: paid.id,
    amountMinor: amount,
    actorId: req.user.id,
  });

  res.status(201).json({
    refundId: refund.id,
    amountMinor: amount,
    status: refund.status,
    remainingMinor: remaining - amount,
  });
};

module.exports = { createIntent, handleWebhook, refundPayment };
