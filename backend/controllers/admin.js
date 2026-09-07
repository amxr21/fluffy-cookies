/**
 * Admin controllers.
 *
 * Every route here sits behind `requireAdmin`, which re-checks the role against
 * the database on each request — a `role` claim baked into a token at login is
 * stale the moment someone is demoted.
 */
const repo = require("../repo");
const { notFound, conflict } = require("../errors/AppError");
const { assertTransition, allowedNext } = require("../lib/orderStatus");
const { toOwnerOrder } = require("../lib/orderView");

/**
 * Move an order to a new status.
 *
 * Two checks, deliberately both: `assertTransition` rejects an illegal move
 * with a message naming the legal ones, and the repository re-checks the
 * current status under a row lock — so two admins pressing the same button at
 * once produce one transition and one history row, not two.
 */
const setOrderStatus = async (req, res) => {
  const { orderNumber } = req.params;
  const { status, note } = req.body;

  const order = await repo.findOrderIdByNumber(orderNumber);
  if (!order) throw notFound("Order not found");

  assertTransition(order.status, status);

  const result = await repo.updateOrderStatus({
    orderId: order.id,
    from: order.status,
    to: status,
    actorId: req.user.id,
    note,
  });

  if (!result) throw notFound("Order not found");
  if (result.conflict) {
    // Someone else moved it between our read and our write.
    throw conflict(
      `This order was changed to ${result.current} by someone else. Reload and try again.`
    );
  }

  res.json({
    orderNumber,
    status: result.to,
    previousStatus: result.from,
    allowedNext: allowedNext(result.to),
  });
};

/** Full order detail for an operator: the owner view plus its history. */
const getOrder = async (req, res) => {
  const { orderNumber } = req.params;

  const order = await repo.getOrderByNumber(orderNumber);
  if (!order) throw notFound("Order not found");

  const summary = await repo.findOrderIdByNumber(orderNumber);
  const events = await repo.getOrderEvents(summary.id);

  res.json({
    ...toOwnerOrder(order),
    allowedNext: allowedNext(order.status),
    events,
  });
};

/** Stock levels for every product, with low-stock flagged for the dashboard. */
const listStock = async (_req, res) => {
  const rows = await repo.listStock();
  res.json(
    rows.map((row) => ({
      ...row,
      lowStock: row.trackStock && row.available <= row.lowStockThreshold,
    }))
  );
};

/**
 * Set a counted stock level.
 *
 * Deliberately absolute, not a delta: an operator counting a shelf knows how
 * many are there, not how many have changed since they last looked. The ledger
 * records the difference.
 */
const setStock = async (req, res) => {
  const { productId } = req.params;
  const { onHand, trackStock, lowStockThreshold } = req.body;

  const result = await repo.setStock({
    productId,
    onHand,
    trackStock,
    lowStockThreshold,
    actorId: req.user.id,
  });
  if (!result) throw notFound("Product not found");

  res.json(await repo.getStock(productId));
};

module.exports = { setOrderStatus, getOrder, listStock, setStock };
