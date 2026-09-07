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
async function listProducts() {
  return clone(db.products);
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
}) {
  const id = nextOrderId();
  const orderNumber = generateOrderNumber();
  const order = {
    id,
    orderNumber,
    user_id: userId ? Number(userId) : null,
    status: "pending",
    totalMinor,
    currency,
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
  if (idempotencyKey) {
    db.order_idempotency.push({
      idempotency_key: idempotencyKey,
      user_id: userId ? Number(userId) : null,
      order_id: id,
    });
  }
  return clone(order);
}
async function getOrdersByUser(userId) {
  return clone(db.orders.filter((o) => o.user_id === Number(userId)));
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

module.exports = {
  findUserById,
  upsertGoogleUser,
  listProducts,
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
