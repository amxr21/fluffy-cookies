/** Order controllers — create (checkout), history, track-by-number. */
const repo = require("../repo");
const { notFound, badRequest, forbidden, conflict } = require("../errors/AppError");
const {
  assertMinor,
  lineTotal,
  sumMinor,
  DEFAULT_CURRENCY,
} = require("../lib/money");
const { toPublicOrder, toOwnerOrder } = require("../lib/orderView");
const { readPageParams, paginated } = require("../lib/pagination");
const mailer = require("../email/mailer");
const {
  normalizeCode,
  validateDiscount,
  rejectionMessage,
} = require("../lib/discounts");
const { normalizeOrderNumber, isValidOrderNumber } = require("../lib/orderNumber");

const createOrder = async (req, res) => {
  const { fulfillment, payment, contact, items } = req.body;
  const userId = req.user?.id ?? null;

  // A retry, a double-click, or a second tab must not place a second order.
  // The key is scoped to the caller, so one customer's key can never return
  // another customer's order.
  const rawKey = req.get("Idempotency-Key");
  // Bound and charset-check the key before it reaches a PRIMARY KEY column.
  const idempotencyKey =
    rawKey && /^[A-Za-z0-9._-]{8,64}$/.test(rawKey) ? rawKey : null;
  if (rawKey && !idempotencyKey) {
    throw badRequest(
      "Idempotency-Key must be 8-64 characters of letters, digits, dot, dash or underscore"
    );
  }
  if (idempotencyKey) {
    const existing = await repo.findOrderByIdempotencyKey(idempotencyKey, userId);
    if (existing) {
      return res.status(200).json({
        orderNumber: existing.orderNumber,
        totalMinor: existing.totalMinor ?? existing.total_minor,
        currency: existing.currency,
        idempotentReplay: true,
      });
    }
  }

  // Price, name and total all come from the database — the request body
  // supplies only which product and how many. A cart posted with its own
  // prices, or a `total` field, changes nothing about what is charged.
  const priced = [];
  for (const it of items) {
    const product = await repo.findProductById(it.product_id);
    if (!product) throw badRequest(`Unknown product: ${it.product_id}`);

    priced.push({
      product_id: it.product_id,
      quantity: it.quantity,
      // Snapshotted onto the order line so a later edit to the product cannot
      // change what this order says it charged.
      unitPriceMinor: assertMinor(product.price_minor, "product.price_minor"),
      name: product.name,
    });
  }

  const subtotalMinor = sumMinor(
    priced.map((line) => lineTotal(line.unitPriceMinor, line.quantity))
  );

  // The body supplies a CODE and nothing else — never an amount. What it is
  // worth is computed here from the stored row.
  let discount = null;
  let totalMinor = subtotalMinor;

  const code = normalizeCode(req.body.discount_code);
  if (code) {
    const row = await repo.findDiscountByCode(code);
    const userRedemptions = row
      ? await repo.countUserRedemptions(row.id, req.user?.id)
      : 0;

    const result = validateDiscount({
      discount: row,
      subtotalMinor,
      userRedemptions,
    });

    // Refuse rather than silently ignoring: a customer who typed a code and was
    // charged full price with no explanation is the bug this replaces.
    if (!result.ok) throw badRequest(rejectionMessage(result.reason));

    discount = {
      id: row.id,
      code: row.code,
      amountMinor: result.discountMinor,
      usageLimit: row.usage_limit ?? null,
    };
    totalMinor = subtotalMinor - result.discountMinor;
  }

  const order = await repo.createOrder({
    userId,
    fulfillment,
    payment,
    contact,
    items: priced,
    totalMinor,
    currency: DEFAULT_CURRENCY,
    idempotencyKey,
    discount,
  });

  // The repository refuses rather than overselling; surface it as a 409 naming
  // the product, so the cart page can point at the line to change.
  if (order.outOfStock) {
    throw conflict(
      `Sorry — ${order.outOfStock.name || "an item"} sold out while you were checking out. Please adjust your cart.`
    );
  }

  // The last use was claimed between validation and the write.
  if (order.discountUnavailable) {
    throw conflict("That code was just fully redeemed. Please remove it and try again.");
  }

  if (userId) await repo.clearCart(userId);

  // Fire-and-forget: the order exists and matters more than its confirmation.
  // `send` never throws, and the `.catch` is belt-and-braces against a future
  // change making it do so — an unhandled rejection here would crash the
  // process long after the response went out.
  void mailer
    .send("orderConfirmed", contact?.email, {
      orderNumber: order.orderNumber,
      totalMinor: order.totalMinor,
      currency: order.currency,
      items: priced.map((line) => ({
        name_snapshot: line.name,
        quantity: line.quantity,
        unit_price_minor: line.unitPriceMinor,
        currency: order.currency,
      })),
    })
    .catch(() => {});

  res.status(201).json({
    orderNumber: order.orderNumber,
    subtotalMinor,
    discountCode: discount?.code ?? null,
    discountMinor: discount?.amountMinor ?? 0,
    totalMinor: order.totalMinor,
    currency: order.currency,
  });
};

const myOrders = async (req, res) => {
  // The :userId in the path must be the caller's own.
  //
  // Answered with 403, not an empty list: "[]" is indistinguishable from "you
  // have no orders", so a client cannot tell a real empty state from a refusal
  // and neither can a log. The standard asks for unauthorised to be its own
  // designed state.
  if (String(req.user.id) !== String(req.params.userId)) {
    throw forbidden("You can only view your own orders");
  }
  const { limit, offset } = readPageParams(req.query);
  const [orders, total] = await Promise.all([
    repo.getOrdersByUser(req.user.id, { limit, offset }),
    repo.countOrdersByUser(req.user.id),
  ]);
  res.json(paginated(orders.map(toOwnerOrder), { limit, offset, total }));
};

const trackOrder = async (req, res) => {
  // Tolerate how a customer actually types a number read off a phone: lowercase,
  // spaced, with O for 0. Rejecting a well-formed-but-wrong shape before the
  // lookup also keeps junk from reaching the database on a scraping run.
  const orderNumber = normalizeOrderNumber(req.params.orderNumber);
  if (!isValidOrderNumber(orderNumber) && !/^FL\d+$/.test(orderNumber)) {
    throw notFound("Order not found");
  }

  const order = await repo.getOrderByNumber(orderNumber);
  if (!order) throw notFound("Order not found");

  // Public view only — this route has no auth, so anything returned here is
  // readable by anyone holding an order number. See lib/orderView.js.
  res.json(toPublicOrder(order));
};

/**
 * Check a code without placing an order, so checkout can show what it is worth
 * before submitting rather than surprising the customer at the end.
 *
 * Validates against the same logic as placement, but claims nothing — the
 * authoritative check still happens inside the order transaction.
 */
const checkDiscount = async (req, res) => {
  const code = normalizeCode(req.body.code);
  const subtotalMinor = req.body.subtotal_minor;

  const row = code ? await repo.findDiscountByCode(code) : null;
  const userRedemptions = row
    ? await repo.countUserRedemptions(row.id, req.user?.id)
    : 0;

  const result = validateDiscount({ discount: row, subtotalMinor, userRedemptions });

  if (!result.ok) {
    return res.json({ valid: false, message: rejectionMessage(result.reason) });
  }

  res.json({
    valid: true,
    code: row.code,
    discountMinor: result.discountMinor,
    totalMinor: subtotalMinor - result.discountMinor,
  });
};

module.exports = { createOrder, myOrders, trackOrder, checkDiscount };
