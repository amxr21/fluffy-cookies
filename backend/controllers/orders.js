/** Order controllers — create (checkout), history, track-by-number. */
const repo = require("../repo");
const { notFound, badRequest } = require("../errors/AppError");

const createOrder = async (req, res) => {
  const { fulfillment, payment, contact, items } = req.body;

  // Compute total server-side from real product prices (never trust client totals).
  let total = 0;
  for (const it of items) {
    const product = await repo.findProductById(it.product_id);
    if (!product) throw badRequest(`Unknown product: ${it.product_id}`);
    total += Number(product.price) * it.quantity;
  }

  const userId = req.user?.id ?? null;
  const order = await repo.createOrder({
    userId,
    fulfillment,
    payment,
    contact,
    items,
    total,
  });

  if (userId) await repo.clearCart(userId);

  res.status(201).json({ orderNumber: order.orderNumber, total: order.total });
};

const myOrders = async (req, res) => {
  // userId param must match the authenticated user.
  if (String(req.user.id) !== String(req.params.userId)) {
    return res.json([]);
  }
  res.json(await repo.getOrdersByUser(req.user.id));
};

const trackOrder = async (req, res) => {
  const order = await repo.getOrderByNumber(req.params.orderNumber);
  if (!order) throw notFound("Order not found");
  res.json(order);
};

module.exports = { createOrder, myOrders, trackOrder };
