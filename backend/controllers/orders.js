/** Order controllers — create (checkout), history, track-by-number. */
const repo = require("../repo");
const { notFound, badRequest } = require("../errors/AppError");
const {
  assertMinor,
  lineTotal,
  sumMinor,
  DEFAULT_CURRENCY,
} = require("../lib/money");
const { toPublicOrder, toOwnerOrder } = require("../lib/orderView");
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

  const totalMinor = sumMinor(
    priced.map((line) => lineTotal(line.unitPriceMinor, line.quantity))
  );

  const order = await repo.createOrder({
    userId,
    fulfillment,
    payment,
    contact,
    items: priced,
    totalMinor,
    currency: DEFAULT_CURRENCY,
    idempotencyKey,
  });

  if (userId) await repo.clearCart(userId);

  res.status(201).json({
    orderNumber: order.orderNumber,
    totalMinor: order.totalMinor,
    currency: order.currency,
  });
};

const myOrders = async (req, res) => {
  // userId param must match the authenticated user.
  if (String(req.user.id) !== String(req.params.userId)) {
    return res.json([]);
  }
  const orders = await repo.getOrdersByUser(req.user.id);
  res.json(orders.map(toOwnerOrder));
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

module.exports = { createOrder, myOrders, trackOrder };
