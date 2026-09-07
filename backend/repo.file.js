/** File-data implementation of the repository (USE_FILE_DATA=true). */
const { db, nextUserId, nextOrderId } = require("./fileStore");
const { generateOrderNumber } = require("./lib/orderNumber");

const clone = (x) => JSON.parse(JSON.stringify(x));

// --- users ---
async function findUserById(id) {
  return clone(db.users.find((u) => u.id === Number(id)) || null);
}
async function upsertGoogleUser({ googleId, email, name, picture }) {
  let user = db.users.find((u) => u.google_id === googleId);
  if (!user) user = db.users.find((u) => u.email === email);
  if (user) {
    user.google_id = googleId;
    user.name = user.name || name;
    user.picture = picture;
  } else {
    user = {
      id: nextUserId(),
      google_id: googleId,
      email,
      name,
      picture,
      role: "customer",
    };
    db.users.push(user);
  }
  return clone(user);
}

// --- products ---
async function listProducts({ limit, offset } = {}) {
  const all = clone(db.products);
  return limit == null ? all : all.slice(offset, offset + limit);
}

async function countProducts() {
  return db.products.length;
}
async function findProductById(id) {
  return clone(db.products.find((p) => p.id === Number(id)) || null);
}

// --- cart ---
function decorateCartLine(line) {
  const p = db.products.find((pr) => pr.id === Number(line.product_id));
  // Shape matches the storefront's CartLine: `id` is the slug it keys UI state
  // on, `productId` is the numeric id it must send back on writes.
  return {
    id: p?.slug ?? String(line.product_id),
    productId: Number(line.product_id),
    product_id: line.product_id,
    name: p?.name ?? "",
    description: p?.description ?? "",
    price_minor: p?.price_minor ?? 0,
    currency: p?.currency ?? "AED",
    image: p?.image ?? "",
    quantity: line.quantity,
  };
}
async function getCart(userId) {
  return db.cart_items
    .filter((c) => c.user_id === Number(userId))
    .map(decorateCartLine);
}
async function addToCart(userId, productId, quantity) {
  const existing = db.cart_items.find(
    (c) => c.user_id === Number(userId) && c.product_id === Number(productId)
  );
  if (existing) existing.quantity += quantity;
  else db.cart_items.push({ user_id: Number(userId), product_id: Number(productId), quantity });
  return { itemStatus: existing ? "incremented" : "added" };
}
async function setCartQuantity(userId, productId, quantity) {
  const idx = db.cart_items.findIndex(
    (c) => c.user_id === Number(userId) && c.product_id === Number(productId)
  );
  if (quantity <= 0) {
    if (idx >= 0) db.cart_items.splice(idx, 1);
  } else if (idx >= 0) {
    db.cart_items[idx].quantity = quantity;
  } else {
    db.cart_items.push({ user_id: Number(userId), product_id: Number(productId), quantity });
  }
}
async function removeFromCart(userId, productId) {
  const idx = db.cart_items.findIndex(
    (c) => c.user_id === Number(userId) && c.product_id === Number(productId)
  );
  if (idx >= 0) db.cart_items.splice(idx, 1);
}
async function clearCart(userId) {
  db.cart_items = db.cart_items.filter((c) => c.user_id !== Number(userId));
}

// --- likes ---
async function getLikes(userId) {
  const ids = db.likes
    .filter((l) => l.user_id === Number(userId))
    .map((l) => l.product_id);
  return clone(db.products.filter((p) => ids.includes(p.id))).map((p) => ({
    ...p,
    id: String(p.id),
  }));
}
async function toggleLike(userId, productId) {
  const idx = db.likes.findIndex(
    (l) => l.user_id === Number(userId) && l.product_id === Number(productId)
  );
  if (idx >= 0) {
    db.likes.splice(idx, 1);
    return { liked: false };
  }
  db.likes.push({ user_id: Number(userId), product_id: Number(productId) });
  return { liked: true };
}

// --- orders ---
/** Look up the order a previous attempt with this key already created. */
async function findOrderByIdempotencyKey(key, userId) {
  const claim = db.order_idempotency.find(
    (r) => r.idempotency_key === key && String(r.user_id ?? "") === String(userId ?? "")
  );
  if (!claim) return null;
  return clone(db.orders.find((o) => o.id === claim.order_id) || null);
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
  // Reserve before creating anything, and unwind on failure — the MySQL path
  // gets this from the transaction; here it has to be explicit.
  const reserved = [];
  for (const it of items) {
    if (!reserveStockSync(it.product_id, it.quantity)) {
      for (const done of reserved) releaseStockSync(done.product_id, done.quantity);
      return { outOfStock: { productId: it.product_id, name: it.name } };
    }
    reserved.push(it);
  }

  // Claim the discount before creating the order, unwinding the stock
  // reservations if the last use was taken in the meantime.
  if (discount && !claimDiscountSync(discount.id, discount.usageLimit ?? null)) {
    for (const done of reserved) releaseStockSync(done.product_id, done.quantity);
    return { discountUnavailable: true };
  }

  const id = nextOrderId();
  const orderNumber = generateOrderNumber();
  const order = {
    id,
    orderNumber,
    user_id: userId ? Number(userId) : null,
    status: "pending",
    totalMinor,
    currency,
    discount_code: discount?.code || null,
    discount_minor: discount?.amountMinor || 0,
    shipping_minor: shipping?.feeMinor || 0,
    shipping_zone: shipping?.zoneId || null,
    fulfillment,
    payment,
    contact,
    // Snapshot what was charged, mirroring the MySQL repo: the line keeps its
    // own price and name so a later product edit cannot rewrite this order.
    items: items.map((it) => ({
      product_id: it.product_id,
      quantity: it.quantity,
      unit_price_minor: it.unitPriceMinor,
      currency,
      name_snapshot: it.name,
    })),
    createdAt: new Date().toISOString(),
  };
  db.orders.push(order);
  if (discount) {
    recordRedemptionSync({
      discountId: discount.id,
      orderId: id,
      userId,
      amountMinor: discount.amountMinor,
    });
  }
  for (const it of items) {
    recordStockMovementSync({
      productId: it.product_id,
      delta: -it.quantity,
      reason: "reserved",
      refType: "order",
      refId: orderNumber,
    });
  }
  // Placement is the first history event — `from` is null, the order came
  // from nowhere.
  db.order_events.push({
    id: db.order_events.length + 1,
    order_id: id,
    from_status: null,
    to_status: "pending",
    actor_id: null,
    note: null,
    created_at: order.createdAt,
  });
  if (idempotencyKey) {
    db.order_idempotency.push({
      idempotency_key: idempotencyKey,
      user_id: userId ? Number(userId) : null,
      order_id: id,
    });
  }
  return clone(order);
}
async function getOrdersByUser(userId, { limit, offset } = {}) {
  const mine = clone(
    db.orders
      .filter((o) => o.user_id === Number(userId))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  );
  return limit == null ? mine : mine.slice(offset, offset + limit);
}

async function countOrdersByUser(userId) {
  return db.orders.filter((o) => o.user_id === Number(userId)).length;
}
async function getOrderByNumber(orderNumber) {
  return clone(db.orders.find((o) => o.orderNumber === orderNumber) || null);
}

// --- sessions ---
async function createSession({ id, userId, tokenHash, familyId, expiresAt, userAgent, ip }) {
  db.sessions.push({
    id,
    user_id: Number(userId),
    token_hash: tokenHash,
    family_id: familyId,
    used_at: null,
    revoked_at: null,
    expires_at: expiresAt,
    user_agent: userAgent || null,
    ip: ip || null,
  });
  return { id, familyId };
}

async function findSessionByTokenHash(tokenHash) {
  const row = db.sessions.find((r) => r.token_hash === tokenHash);
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    familyId: row.family_id,
    usedAt: row.used_at,
    revokedAt: row.revoked_at,
    expiresAt: row.expires_at,
  };
}

async function markSessionUsed(id) {
  const row = db.sessions.find((r) => r.id === id);
  if (row) row.used_at = new Date();
}

async function revokeSession(id) {
  const row = db.sessions.find((r) => r.id === id);
  if (row) row.revoked_at = new Date();
}

async function revokeSessionFamily(familyId) {
  for (const row of db.sessions) {
    if (row.family_id === familyId && !row.revoked_at) row.revoked_at = new Date();
  }
}

async function revokeAllUserSessions(userId) {
  for (const row of db.sessions) {
    if (row.user_id === Number(userId) && !row.revoked_at) row.revoked_at = new Date();
  }
}

async function bumpTokenVersion(userId) {
  const user = db.users.find((u) => u.id === Number(userId));
  if (user) user.token_version = (user.token_version || 0) + 1;
}

async function deleteExpiredSessions() {
  const before = db.sessions.length;
  db.sessions = db.sessions.filter((r) => new Date(r.expires_at) >= new Date());
  return before - db.sessions.length;
}

// --- order status ---
async function updateOrderStatus({ orderId, from, to, actorId, note }) {
  const order = db.orders.find((o) => o.id === Number(orderId));
  if (!order) return null;

  if (from !== undefined && order.status !== from) {
    return { conflict: true, current: order.status };
  }

  const current = order.status;
  order.status = to;
  db.order_events.push({
    id: db.order_events.length + 1,
    order_id: Number(orderId),
    from_status: current,
    to_status: to,
    actor_id: actorId || null,
    note: note || null,
    created_at: new Date().toISOString(),
  });

  // Settle the reservation alongside the status change — see the note in
  // repo.mysql.js.
  if (to === "cancelled" || to === "completed") {
    for (const line of order.items || []) {
      if (to === "cancelled") {
        releaseStockSync(line.product_id, line.quantity);
        recordStockMovementSync({
          productId: line.product_id,
          delta: line.quantity,
          reason: "cancelled",
          refType: "order",
          refId: order.orderNumber,
          actorId,
        });
      } else {
        consumeStockSync(line.product_id, line.quantity);
        recordStockMovementSync({
          productId: line.product_id,
          delta: 0,
          reason: "collected",
          refType: "order",
          refId: order.orderNumber,
          actorId,
        });
      }
    }
  }

  return { orderId: Number(orderId), from: current, to };
}

async function getOrderEvents(orderId) {
  return clone(
    db.order_events
      .filter((e) => e.order_id === Number(orderId))
      .map((e) => ({
        fromStatus: e.from_status,
        toStatus: e.to_status,
        actorId: e.actor_id,
        note: e.note,
        createdAt: e.created_at,
      }))
  );
}

async function findOrderIdByNumber(orderNumber) {
  const order = db.orders.find((o) => o.orderNumber === orderNumber);
  return order ? { id: order.id, status: order.status } : null;
}

// --- inventory ---
const stockRow = (productId) =>
  db.inventory.find((r) => r.product_id === Number(productId));

/** Mirrors the MySQL conditional UPDATE: check and decrement are one step. */
function reserveStockSync(productId, quantity) {
  const row = stockRow(productId);
  if (!row) return true; // no inventory row = not tracked
  if (!row.track_stock) return true;
  if (row.on_hand - row.reserved < quantity) return false;
  row.reserved += quantity;
  return true;
}

function releaseStockSync(productId, quantity) {
  const row = stockRow(productId);
  if (row) row.reserved = Math.max(row.reserved - quantity, 0);
}

function consumeStockSync(productId, quantity) {
  const row = stockRow(productId);
  if (!row || !row.track_stock) return;
  row.on_hand = Math.max(row.on_hand - quantity, 0);
  row.reserved = Math.max(row.reserved - quantity, 0);
}

function recordStockMovementSync({ productId, delta, reason, refType, refId, actorId }) {
  db.inventory_ledger.push({
    id: db.inventory_ledger.length + 1,
    product_id: Number(productId),
    delta,
    reason,
    ref_type: refType || null,
    ref_id: refId || null,
    actor_id: actorId || null,
    created_at: new Date().toISOString(),
  });
}

async function getStock(productId) {
  const row = stockRow(productId);
  if (!row) return null;
  return {
    productId: row.product_id,
    onHand: row.on_hand,
    reserved: row.reserved,
    available: row.on_hand - row.reserved,
    lowStockThreshold: row.low_stock_threshold,
    trackStock: !!row.track_stock,
  };
}

async function listStock() {
  return db.inventory.map((row) => {
    const product = db.products.find((p) => p.id === row.product_id);
    return {
      productId: row.product_id,
      name: product?.name ?? "",
      onHand: row.on_hand,
      reserved: row.reserved,
      available: row.on_hand - row.reserved,
      lowStockThreshold: row.low_stock_threshold,
      trackStock: !!row.track_stock,
    };
  });
}

async function setStock({ productId, onHand, trackStock, lowStockThreshold, actorId }) {
  const row = stockRow(productId);
  if (!row) return null;

  const previous = row.on_hand;
  if (onHand !== undefined) row.on_hand = onHand;
  if (trackStock !== undefined) row.track_stock = trackStock ? 1 : 0;
  if (lowStockThreshold !== undefined) row.low_stock_threshold = lowStockThreshold;

  if (onHand !== undefined && onHand !== previous) {
    recordStockMovementSync({
      productId,
      delta: onHand - previous,
      reason: "adjustment",
      refType: "manual",
      actorId,
    });
  }
  return { productId: Number(productId), onHand: row.on_hand, previousOnHand: previous };
}

// --- discounts ---
async function findDiscountByCode(code) {
  return clone(db.discounts.find((d) => d.code === code) || null);
}

async function countUserRedemptions(discountId, userId) {
  if (!userId) return 0;
  return db.discount_redemptions.filter(
    (r) => r.discount_id === Number(discountId) && String(r.user_id) === String(userId)
  ).length;
}

/** Mirrors the conditional UPDATE: check and increment in one step. */
function claimDiscountSync(discountId, usageLimit) {
  const row = db.discounts.find((d) => d.id === Number(discountId));
  if (!row) return false;
  if (usageLimit != null && row.used_count >= usageLimit) return false;
  row.used_count += 1;
  return true;
}

function recordRedemptionSync({ discountId, orderId, userId, amountMinor }) {
  db.discount_redemptions.push({
    id: db.discount_redemptions.length + 1,
    discount_id: Number(discountId),
    order_id: Number(orderId),
    user_id: userId ? Number(userId) : null,
    amount_minor: amountMinor,
    redeemed_at: new Date().toISOString(),
  });
}

async function listDiscounts() {
  return clone(db.discounts).map((d) => ({
    id: d.id,
    code: d.code,
    type: d.type,
    value: d.value,
    maxDiscountMinor: d.max_discount_minor ?? null,
    minSubtotalMinor: d.min_subtotal_minor ?? 0,
    startsAt: d.starts_at ?? null,
    endsAt: d.ends_at ?? null,
    usageLimit: d.usage_limit ?? null,
    perUserLimit: d.per_user_limit ?? null,
    usedCount: d.used_count,
    active: d.active,
  }));
}

module.exports = {
  findUserById,
  upsertGoogleUser,
  listProducts,
  countProducts,
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
