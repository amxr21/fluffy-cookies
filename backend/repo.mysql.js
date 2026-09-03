/** MySQL implementation of the repository. Parameterized SQL via dbClient. */
const { query, withTransaction } = require("./dbClient");

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
async function listProducts() {
  return query("SELECT * FROM products ORDER BY id", [], { op: "listProducts" });
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
         p.price, p.image, ci.quantity
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
async function createOrder({ userId, fulfillment, payment, contact, items, total }) {
  return withTransaction(async (q) => {
    const result = await q(
      `INSERT INTO orders (user_id, status, total, fulfillment, payment, contact)
       VALUES (?, 'pending', ?, ?, ?, ?)`,
      [userId || null, total, fulfillment, payment, JSON.stringify(contact || {})],
      { op: "createOrder.insert" }
    );
    const orderId = result.insertId;
    const orderNumber = `FL${orderId}`;
    await q("UPDATE orders SET order_number = ? WHERE id = ?", [orderNumber, orderId], {
      op: "createOrder.number",
    });
    for (const it of items) {
      await q(
        "INSERT INTO order_items (order_id, product_id, quantity) VALUES (?, ?, ?)",
        [orderId, it.product_id, it.quantity],
        { op: "createOrder.item" }
      );
    }
    return { id: orderId, orderNumber, status: "pending", total };
  });
}

const ORDER_SELECT = `
  SELECT o.order_number AS orderNumber, o.status, o.total, o.fulfillment,
         o.created_at AS createdAt
  FROM orders o`;

async function getOrdersByUser(userId) {
  const orders = await query(`${ORDER_SELECT} WHERE o.user_id = ? ORDER BY o.created_at DESC`, [userId], {
    op: "getOrdersByUser",
  });
  return Promise.all(orders.map(withItems));
}
async function getOrderByNumber(orderNumber) {
  const rows = await query(`${ORDER_SELECT} WHERE o.order_number = ?`, [orderNumber], {
    op: "getOrderByNumber",
  });
  return rows[0] ? withItems(rows[0]) : null;
}
async function withItems(order) {
  const items = await query(
    `SELECT oi.product_id, p.name, p.price, oi.quantity
     FROM order_items oi JOIN orders o ON o.id = oi.order_id
     JOIN products p ON p.id = oi.product_id
     WHERE o.order_number = ?`,
    [order.orderNumber],
    { op: "order.items" }
  );
  return { ...order, items };
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
