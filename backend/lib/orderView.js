/**
 * Response projections for orders.
 *
 * `GET /orders/track/:orderNumber` needs no login, so whatever it returns is
 * readable by anyone holding (or guessing) an order number. It previously
 * returned the stored row wholesale — including `contact`, which carries the
 * customer's name, phone, address, city and delivery notes.
 *
 * These functions are allowlists, not blocklists. A field is invisible until
 * someone adds it here, so a column added to `orders` later cannot leak by
 * default — which is exactly how the original leak happened.
 */

/** Line items, safe for the public view: what was bought, not who bought it. */
const publicItems = (items = []) =>
  items.map((it) => ({
    name_snapshot: it.name_snapshot,
    quantity: it.quantity,
    unit_price_minor: it.unit_price_minor,
    currency: it.currency,
  }));

/**
 * The public tracking view — the minimum a customer needs to answer "where is
 * my order": what state it is in, how it is coming, when it was placed, and
 * what is in the box.
 *
 * Deliberately excluded: `contact` (all PII), `user_id`, the internal `id`, and
 * `payment`. None answers that question, and each one is worth something to a
 * scraper.
 */
function toPublicOrder(order) {
  if (!order) return null;
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    fulfillment: order.fulfillment,
    totalMinor: order.totalMinor ?? order.total_minor,
    currency: order.currency,
    createdAt: order.createdAt,
    items: publicItems(order.items),
  };
}

/**
 * The owner's view, for `GET /orders/user/:userId` behind `requireAuth`.
 *
 * Adds back the delivery address, because a signed-in customer looking at their
 * own order history should see where it is going. Still omits `user_id` and the
 * internal `id`, which are ours rather than theirs.
 */
function toOwnerOrder(order) {
  if (!order) return null;
  const contact = order.contact || {};
  return {
    ...toPublicOrder(order),
    payment: order.payment,
    contact: {
      name: contact.name,
      phone: contact.phone,
      address: contact.address,
      city: contact.city,
      note: contact.note,
    },
  };
}

module.exports = { toPublicOrder, toOwnerOrder };
