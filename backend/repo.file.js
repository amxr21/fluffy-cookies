/** File-data implementation of the repository (USE_FILE_DATA=true). */
const { db, nextUserId, nextOrderId } = require("./fileStore");

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
  return {
    id: String(line.product_id),
    product_id: line.product_id,
    name: p?.name ?? "",
    description: p?.description ?? "",
    price: p?.price ?? 0,
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
async function createOrder({ userId, fulfillment, payment, contact, items, total }) {
  const id = nextOrderId();
  const orderNumber = `FL${id}`;
  const order = {
    id,
    orderNumber,
    user_id: userId ? Number(userId) : null,
    status: "pending",
    total,
    fulfillment,
    payment,
    contact,
    items,
    createdAt: new Date().toISOString(),
  };
  db.orders.push(order);
  return clone(order);
}
async function getOrdersByUser(userId) {
  return clone(db.orders.filter((o) => o.user_id === Number(userId)));
}
async function getOrderByNumber(orderNumber) {
  return clone(db.orders.find((o) => o.orderNumber === orderNumber) || null);
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
  getOrdersByUser,
  getOrderByNumber,
};
