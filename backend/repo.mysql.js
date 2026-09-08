/** MySQL implementation of the repository. Parameterized SQL via dbClient. */
const { query, withTransaction } = require("./dbClient");
const { generateOrderNumber } = require("./lib/orderNumber");

// --- users ---
async function findUserById(id) {
  const rows = await query("SELECT * FROM users WHERE id = ?", [id], { op: "findUserById" });
  return rows[0] || null;
}
async function upsertGoogleUser({ googleId, email, name, picture }) {
  const existing = await query("SELECT * FROM users WHERE google_id = ?", [googleId], {
    op: "auth.findByGoogle",
  });
  if (existing.length) return existing[0];

  const byEmail = await query("SELECT * FROM users WHERE email = ?", [email], {
    op: "auth.findByEmail",
  });
  if (byEmail.length) {
    await query(
      "UPDATE users SET google_id = ?, name = COALESCE(NULLIF(name,''), ?), picture = ? WHERE id = ?",
      [googleId, name, picture, byEmail[0].id],
      { op: "auth.linkByEmail" }
    );
    return { ...byEmail[0], google_id: googleId, picture };
  }
  const result = await query(
    "INSERT INTO users (google_id, name, email, picture, role) VALUES (?, ?, ?, ?, 'customer')",
    [googleId, name, email, picture],
    { op: "auth.createUser" }
  );
  return { id: result.insertId, google_id: googleId, email, name, picture, role: "customer" };
}

// --- products ---
async function listProducts({ limit, offset } = {}) {
  if (limit == null) {
    return query("SELECT * FROM products ORDER BY id", [], { op: "listProducts" });
  }
  return query("SELECT * FROM products ORDER BY id LIMIT ? OFFSET ?", [limit, offset], {
    op: "listProducts",
  });
}

/**
 * Escape LIKE wildcards in a user's search term.
 *
 * Without this, a customer searching for "50%" matches every product, and "_"
 * matches any single character. Parameterisation stops injection but does not
 * touch wildcards — they are data as far as the driver is concerned.
 */
const escapeLike = (term) => String(term).replace(/[%_\\]/g, (c) => `\\${c}`);

/**
 * Search by name or description.
 *
 * A LIKE query, which the standard explicitly allows at Tier 1 ("even if it's
 * a LIKE query at Tier 1"). With 16 products anything more is premature; when
 * the catalogue grows this is the one function to replace.
 *
 * The term is escaped for LIKE wildcards before being parameterised — without
 * it a customer searching for "50%" matches everything.
 */
async function searchProducts(term, { limit, offset }) {
  const like = `%${escapeLike(term)}%`;
  return query(
    `SELECT * FROM products
      WHERE name LIKE ? OR description LIKE ?
      ORDER BY id LIMIT ? OFFSET ?`,
    [like, like, limit, offset],
    { op: "searchProducts" }
  );
}

async function countSearchProducts(term) {
  const like = `%${escapeLike(term)}%`;
  const rows = await query(
    "SELECT COUNT(*) AS n FROM products WHERE name LIKE ? OR description LIKE ?",
    [like, like],
    { op: "countSearchProducts" }
  );
  return Number(rows[0]?.n || 0);
}

async function countProducts() {
  const rows = await query("SELECT COUNT(*) AS n FROM products", [], {
    op: "countProducts",
  });
  return Number(rows[0]?.n || 0);
}
async function findProductById(id) {
  const rows = await query("SELECT * FROM products WHERE id = ?", [id], { op: "findProductById" });
  return rows[0] || null;
}

// --- cart ---
// `productId` mirrors the file repo and the storefront's CartLine — it is the
// value the client must send back on cart/order writes. (The products table has
// no slug column, so `id` stays numeric here; the client keys off productId.)
const CART_SELECT = `
  SELECT p.id AS id, p.id AS productId, ci.product_id, p.name, p.description,
         p.price_minor, p.currency, p.image, ci.quantity
  FROM cart_items ci JOIN products p ON p.id = ci.product_id
  WHERE ci.user_id = ?`;

async function getCart(userId) {
  return query(CART_SELECT, [userId], { op: "getCart" });
}
async function addToCart(userId, productId, quantity) {
  const result = await query(
    `INSERT INTO cart_items (user_id, product_id, quantity)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
    [userId, productId, quantity],
    { op: "addToCart" }
  );
  return { itemStatus: result.affectedRows === 2 ? "incremented" : "added" };
}
async function setCartQuantity(userId, productId, quantity) {
  if (quantity <= 0) return removeFromCart(userId, productId);
  await query(
    `INSERT INTO cart_items (user_id, product_id, quantity)
     VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)`,
    [userId, productId, quantity],
    { op: "setCartQuantity" }
  );
}
async function removeFromCart(userId, productId) {
  await query("DELETE FROM cart_items WHERE user_id = ? AND product_id = ?", [userId, productId], {
    op: "removeFromCart",
  });
}
async function clearCart(userId) {
  await query("DELETE FROM cart_items WHERE user_id = ?", [userId], { op: "clearCart" });
}

// --- likes ---
async function getLikes(userId) {
  return query(
    `SELECT p.* FROM likes l JOIN products p ON p.id = l.product_id WHERE l.user_id = ?`,
    [userId],
    { op: "getLikes" }
  );
}
async function toggleLike(userId, productId) {
  const rows = await query(
    "SELECT id FROM likes WHERE user_id = ? AND product_id = ?",
    [userId, productId],
    { op: "toggleLike.find" }
  );
  if (rows.length) {
    await query("DELETE FROM likes WHERE user_id = ? AND product_id = ?", [userId, productId], {
      op: "toggleLike.remove",
    });
    return { liked: false };
  }
  await query("INSERT INTO likes (user_id, product_id) VALUES (?, ?)", [userId, productId], {
    op: "toggleLike.add",
  });
  return { liked: true };
}

// --- orders ---
/** Look up the order a previous attempt with this key already created. */
async function findOrderByIdempotencyKey(key, userId) {
  const rows = await query(
    `SELECT o.order_number AS orderNumber, o.status, o.total_minor, o.currency
     FROM order_idempotency oi JOIN orders o ON o.id = oi.order_id
     WHERE oi.idempotency_key = ? AND oi.user_id <=> ?`,
    [key, userId ?? null],
    { op: "findOrderByIdempotencyKey" }
  );
  return rows[0] || null;
}

async function createOrder({
  userId,
  fulfillment,
  payment,
  contact,
  items,
  totalMinor,
  currency,
  idempotencyKey,
  discount,
  shipping,
}) {
  return withTransaction(async (q) => {
    // Reserve stock BEFORE creating anything. A failure here rolls the whole
    // transaction back, so there is no order without its stock and no stock
    // held by an order that was never created.
    for (const it of items) {
      const ok = await reserveStock(q, it.product_id, it.quantity);
      if (!ok) {
        return { outOfStock: { productId: it.product_id, name: it.name } };
      }
    }

    // Generated before the INSERT, not derived from insertId afterwards: the
    // old two-step left every order briefly untrackable, and tied the public
    // number to a sequential database id.
    const orderNumber = generateOrderNumber();
    const result = await q(
      `INSERT INTO orders
         (order_number, user_id, status, total_minor, discount_code, discount_minor,
          currency, fulfillment, payment, contact)
       VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderNumber,
        userId || null,
        totalMinor,
        discount?.code || null,
        discount?.amountMinor || 0,
        shipping?.feeMinor || 0,
        shipping?.zoneId || null,
        currency,
        fulfillment,
        payment,
        JSON.stringify(contact || {}),
      ],
      { op: "createOrder.insert" }
    );
    const orderId = result.insertId;

    // Snapshot the price and name as charged. Reading these back from a live
    // join to `products` would mean editing a product silently rewrites every
    // past invoice.
    for (const it of items) {
      await q(
        `INSERT INTO order_items
           (order_id, product_id, quantity, unit_price_minor, currency, name_snapshot)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, it.product_id, it.quantity, it.unitPriceMinor, currency, it.name],
        { op: "createOrder.item" }
      );
    }
    // Claim the key inside the same transaction as the order. A concurrent
    // duplicate hits the PRIMARY KEY and its whole transaction rolls back, so
    // the race cannot produce two orders.
    for (const it of items) {
      await recordStockMovement(q, {
        productId: it.product_id,
        delta: -it.quantity,
        reason: "reserved",
        refType: "order",
        refId: orderNumber,
      });
    }

    // Claim the discount inside the same transaction as the order. If the last
    // use was taken between validation and here, the whole thing rolls back
    // rather than granting an over-limit redemption.
    if (discount) {
      const claimed = await claimDiscount(q, {
        discountId: discount.id,
        usageLimit: discount.usageLimit ?? null,
      });
      if (!claimed) return { discountUnavailable: true };

      await recordRedemption(q, {
        discountId: discount.id,
        orderId,
        userId,
        amountMinor: discount.amountMinor,
      });
    }

    // Placement is the first history event — `from` is NULL because the order
    // came from nowhere.
    await q(
      "INSERT INTO order_events (order_id, from_status, to_status) VALUES (?, NULL, 'pending')",
      [orderId],
      { op: "createOrder.event" }
    );

    if (idempotencyKey) {
      await q(
        "INSERT INTO order_idempotency (idempotency_key, user_id, order_id) VALUES (?, ?, ?)",
        [idempotencyKey, userId || null, orderId],
        { op: "createOrder.idempotency" }
      );
    }

    return { id: orderId, orderNumber, status: "pending", totalMinor, currency };
  });
}

const ORDER_SELECT = `
  SELECT o.order_number AS orderNumber, o.status, o.total_minor, o.currency,
         o.fulfillment, o.created_at AS createdAt
  FROM orders o`;

async function getOrdersByUser(userId, { limit, offset } = {}) {
  const sql =
    limit == null
      ? `${ORDER_SELECT} WHERE o.user_id = ? ORDER BY o.created_at DESC`
      : `${ORDER_SELECT} WHERE o.user_id = ? ORDER BY o.created_at DESC LIMIT ? OFFSET ?`;
  const params = limit == null ? [userId] : [userId, limit, offset];
  const orders = await query(sql, params, { op: "getOrdersByUser" });
  return Promise.all(orders.map(withItems));
}

async function countOrdersByUser(userId) {
  const rows = await query("SELECT COUNT(*) AS n FROM orders WHERE user_id = ?", [userId], {
    op: "countOrdersByUser",
  });
  return Number(rows[0]?.n || 0);
}
async function getOrderByNumber(orderNumber) {
  const rows = await query(`${ORDER_SELECT} WHERE o.order_number = ?`, [orderNumber], {
    op: "getOrderByNumber",
  });
  return rows[0] ? withItems(rows[0]) : null;
}
async function withItems(order) {
  const items = await query(
    // Snapshot columns only - deliberately no join to `products`, so a later
    // price or name change cannot alter what this order says it charged.
    `SELECT oi.product_id, oi.name_snapshot, oi.unit_price_minor, oi.currency,
            oi.quantity
     FROM order_items oi JOIN orders o ON o.id = oi.order_id
     WHERE o.order_number = ?`,
    [order.orderNumber],
    { op: "order.items" }
  );
  return { ...order, items };
}

// --- sessions ---
/**
 * Refresh-token sessions. The plaintext token never reaches this layer — the
 * caller hashes it — so a database leak yields no working sessions.
 */
async function createSession({ id, userId, tokenHash, familyId, expiresAt, userAgent, ip }) {
  await query(
    `INSERT INTO sessions (id, user_id, token_hash, family_id, expires_at, user_agent, ip)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, tokenHash, familyId, expiresAt, userAgent || null, ip || null],
    { op: "createSession" }
  );
  return { id, familyId };
}

async function findSessionByTokenHash(tokenHash) {
  const rows = await query(
    `SELECT id, user_id AS userId, family_id AS familyId, used_at AS usedAt,
            revoked_at AS revokedAt, expires_at AS expiresAt
     FROM sessions WHERE token_hash = ?`,
    [tokenHash],
    { op: "findSessionByTokenHash" }
  );
  return rows[0] || null;
}

/** Mark a refresh token as exchanged. A second exchange is the reuse signal. */
async function markSessionUsed(id) {
  await query("UPDATE sessions SET used_at = CURRENT_TIMESTAMP WHERE id = ?", [id], {
    op: "markSessionUsed",
  });
}

async function revokeSession(id) {
  await query("UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?", [id], {
    op: "revokeSession",
  });
}

/** Reuse detected: every token descended from the same login is now suspect. */
async function revokeSessionFamily(familyId) {
  await query(
    "UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE family_id = ? AND revoked_at IS NULL",
    [familyId],
    { op: "revokeSessionFamily" }
  );
}

async function revokeAllUserSessions(userId) {
  await query(
    "UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL",
    [userId],
    { op: "revokeAllUserSessions" }
  );
}

/** Invalidate every access token already issued to this user. */
async function bumpTokenVersion(userId) {
  await query("UPDATE users SET token_version = token_version + 1 WHERE id = ?", [userId], {
    op: "bumpTokenVersion",
  });
}

async function deleteExpiredSessions() {
  const result = await query("DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP", [], {
    op: "deleteExpiredSessions",
  });
  return result.affectedRows || 0;
}

// --- order status ---
/**
 * Move an order to a new status and record the move, atomically.
 *
 * The row is re-read inside the transaction with FOR UPDATE and the caller's
 * expected `from` is checked against it. Two admins pressing "Ready" at the
 * same moment would otherwise both read "preparing", both pass the transition
 * check in the service layer, and both write — producing two history rows for
 * one real transition.
 */
async function updateOrderStatus({ orderId, from, to, actorId, note }) {
  return withTransaction(async (q) => {
    const rows = await q(
      "SELECT status FROM orders WHERE id = ? FOR UPDATE",
      [orderId],
      { op: "updateOrderStatus.lock" }
    );
    if (!rows.length) return null;

    const current = rows[0].status;
    // The caller already validated the transition; this catches the row having
    // moved between that check and this write.
    if (from !== undefined && current !== from) {
      return { conflict: true, current };
    }

    await q("UPDATE orders SET status = ? WHERE id = ?", [to, orderId], {
      op: "updateOrderStatus.set",
    });
    await q(
      `INSERT INTO order_events (order_id, from_status, to_status, actor_id, note)
       VALUES (?, ?, ?, ?, ?)`,
      [orderId, current, to, actorId || null, note || null],
      { op: "updateOrderStatus.event" }
    );

    // Settle the reservation in the same transaction as the status change.
    // A cancelled order must put its stock back, and a collected one must
    // stop holding a reservation for goods that have physically left —
    // otherwise reservations leak and the shop looks sold out while stock
    // sits on the shelf.
    if (to === "cancelled" || to === "completed") {
      const lines = await q(
        "SELECT product_id, quantity FROM order_items WHERE order_id = ?",
        [orderId],
        { op: "updateOrderStatus.lines" }
      );
      const orderRow = await q("SELECT order_number FROM orders WHERE id = ?", [orderId], {
        op: "updateOrderStatus.number",
      });
      const refId = orderRow[0]?.order_number;

      for (const line of lines) {
        if (to === "cancelled") {
          await releaseStock(q, line.product_id, line.quantity);
          await recordStockMovement(q, {
            productId: line.product_id,
            delta: line.quantity,
            reason: "cancelled",
            refType: "order",
            refId,
            actorId,
          });
        } else {
          await consumeStock(q, line.product_id, line.quantity);
          await recordStockMovement(q, {
            productId: line.product_id,
            delta: 0,
            reason: "collected",
            refType: "order",
            refId,
            actorId,
          });
        }
      }
    }

    return { orderId, from: current, to };
  });
}

async function getOrderEvents(orderId) {
  return query(
    `SELECT from_status AS fromStatus, to_status AS toStatus, actor_id AS actorId,
            note, created_at AS createdAt
     FROM order_events WHERE order_id = ? ORDER BY created_at, id`,
    [orderId],
    { op: "getOrderEvents" }
  );
}

/** Find an order by its public number, for an admin acting on it. */
async function findOrderIdByNumber(orderNumber) {
  const rows = await query(
    "SELECT id, status FROM orders WHERE order_number = ?",
    [orderNumber],
    { op: "findOrderIdByNumber" }
  );
  return rows[0] || null;
}

// --- inventory ---
/**
 * Reserve stock for one line, atomically.
 *
 * The whole oversell defence is the WHERE clause: the check and the decrement
 * are ONE statement, so two concurrent orders for the last unit cannot both
 * pass. A read-then-write here is a race that two customers WILL hit during a
 * promotion — the standard calls this out specifically.
 *
 * Returns false when there was not enough; the caller rolls the transaction
 * back. `track_stock = 0` products (made to order) always succeed.
 */
async function reserveStock(q, productId, quantity) {
  const result = await q(
    `UPDATE inventory
        SET reserved = reserved + ?
      WHERE product_id = ?
        AND (track_stock = 0 OR on_hand - reserved >= ?)`,
    [quantity, productId, quantity],
    { op: "reserveStock" }
  );
  return result.affectedRows > 0;
}

/** Release a reservation — a cancelled order puts the stock back. */
async function releaseStock(q, productId, quantity) {
  await q(
    `UPDATE inventory
        SET reserved = GREATEST(reserved - ?, 0)
      WHERE product_id = ?`,
    [quantity, productId],
    { op: "releaseStock" }
  );
}

/**
 * Collection: the goods have left. Reserved AND on_hand both drop, because the
 * stock is not merely spoken for any more — it is gone.
 */
async function consumeStock(q, productId, quantity) {
  await q(
    `UPDATE inventory
        SET on_hand = GREATEST(on_hand - ?, 0),
            reserved = GREATEST(reserved - ?, 0)
      WHERE product_id = ? AND track_stock = 1`,
    [quantity, quantity, productId],
    { op: "consumeStock" }
  );
}

async function recordStockMovement(q, { productId, delta, reason, refType, refId, actorId }) {
  await q(
    `INSERT INTO inventory_ledger (product_id, delta, reason, ref_type, ref_id, actor_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [productId, delta, reason, refType || null, refId || null, actorId || null],
    { op: "recordStockMovement" }
  );
}

async function getStock(productId) {
  const rows = await query(
    `SELECT product_id AS productId, on_hand AS onHand, reserved,
            (on_hand - reserved) AS available, low_stock_threshold AS lowStockThreshold,
            track_stock AS trackStock
     FROM inventory WHERE product_id = ?`,
    [productId],
    { op: "getStock" }
  );
  return rows[0] || null;
}

async function listStock() {
  return query(
    `SELECT i.product_id AS productId, p.name, i.on_hand AS onHand, i.reserved,
            (i.on_hand - i.reserved) AS available,
            i.low_stock_threshold AS lowStockThreshold, i.track_stock AS trackStock
     FROM inventory i JOIN products p ON p.id = i.product_id
     ORDER BY i.product_id`,
    [],
    { op: "listStock" }
  );
}

/** Set the counted quantity, logging the difference rather than the new total. */
async function setStock({ productId, onHand, trackStock, lowStockThreshold, actorId }) {
  return withTransaction(async (q) => {
    const rows = await q(
      "SELECT on_hand FROM inventory WHERE product_id = ? FOR UPDATE",
      [productId],
      { op: "setStock.lock" }
    );
    if (!rows.length) return null;

    const previous = rows[0].on_hand;
    const fields = [];
    const params = [];
    if (onHand !== undefined) { fields.push("on_hand = ?"); params.push(onHand); }
    if (trackStock !== undefined) { fields.push("track_stock = ?"); params.push(trackStock ? 1 : 0); }
    if (lowStockThreshold !== undefined) {
      fields.push("low_stock_threshold = ?");
      params.push(lowStockThreshold);
    }
    if (!fields.length) return { productId, onHand: previous };

    params.push(productId);
    await q(`UPDATE inventory SET ${fields.join(", ")} WHERE product_id = ?`, params, {
      op: "setStock.update",
    });

    if (onHand !== undefined && onHand !== previous) {
      await q(
        `INSERT INTO inventory_ledger (product_id, delta, reason, ref_type, actor_id)
         VALUES (?, ?, 'adjustment', 'manual', ?)`,
        [productId, onHand - previous, actorId || null],
        { op: "setStock.ledger" }
      );
    }

    return { productId, onHand: onHand ?? previous, previousOnHand: previous };
  });
}

// --- discounts ---
async function findDiscountByCode(code) {
  const rows = await query("SELECT * FROM discounts WHERE code = ?", [code], {
    op: "findDiscountByCode",
  });
  return rows[0] || null;
}

/** How many times this user has already redeemed this code. */
async function countUserRedemptions(discountId, userId) {
  if (!userId) return 0;
  const rows = await query(
    "SELECT COUNT(*) AS n FROM discount_redemptions WHERE discount_id = ? AND user_id = ?",
    [discountId, userId],
    { op: "countUserRedemptions" }
  );
  return Number(rows[0]?.n || 0);
}

/**
 * Claim one use of a discount, inside the caller's transaction.
 *
 * The row is locked and `used_count` re-read before incrementing: two customers
 * redeeming the last use of a code would otherwise both read used_count = 9
 * against a limit of 10, both pass validation, and both redeem. The conditional
 * UPDATE makes the check and the increment one step.
 *
 * Returns false when the limit was taken in the meantime.
 */
async function claimDiscount(q, { discountId, usageLimit }) {
  const result = await q(
    `UPDATE discounts
        SET used_count = used_count + 1
      WHERE id = ? AND (? IS NULL OR used_count < ?)`,
    [discountId, usageLimit, usageLimit],
    { op: "claimDiscount" }
  );
  return result.affectedRows > 0;
}

async function recordRedemption(q, { discountId, orderId, userId, amountMinor }) {
  await q(
    `INSERT INTO discount_redemptions (discount_id, order_id, user_id, amount_minor)
     VALUES (?, ?, ?, ?)`,
    [discountId, orderId, userId || null, amountMinor],
    { op: "recordRedemption" }
  );
}

async function listDiscounts() {
  return query(
    `SELECT id, code, type, value, max_discount_minor AS maxDiscountMinor,
            min_subtotal_minor AS minSubtotalMinor, starts_at AS startsAt,
            ends_at AS endsAt, usage_limit AS usageLimit,
            per_user_limit AS perUserLimit, used_count AS usedCount, active
     FROM discounts ORDER BY created_at DESC`,
    [],
    { op: "listDiscounts" }
  );
}

module.exports = {
  findUserById,
  upsertGoogleUser,
  listProducts,
  countProducts,
  searchProducts,
  countSearchProducts,
  countOrdersByUser,
  findProductById,
  getCart,
  addToCart,
  setCartQuantity,
  removeFromCart,
  clearCart,
  getLikes,
  toggleLike,
  createOrder,
  findOrderByIdempotencyKey,
  findDiscountByCode,
  countUserRedemptions,
  listDiscounts,
  reserveStock,
  releaseStock,
  consumeStock,
  recordStockMovement,
  getStock,
  listStock,
  setStock,
  updateOrderStatus,
  getOrderEvents,
  findOrderIdByNumber,
  createSession,
  findSessionByTokenHash,
  markSessionUsed,
  revokeSession,
  revokeSessionFamily,
  revokeAllUserSessions,
  bumpTokenVersion,
  deleteExpiredSessions,
  getOrdersByUser,
  getOrderByNumber,
};
