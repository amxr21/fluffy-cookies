/**
 * In-memory data store used when USE_FILE_DATA=true (CI / no-DB testing).
 * Seeded with a small fixed dataset so integration tests (auth, cart, orders)
 * can run without MySQL. Not for production — volatile, single-process.
 */

let nextUserId = 100;
let nextOrderId = 1000;

const db = {
  users: [],
  products: [
    { id: 1, name: "Classic Chocolate Chip", description: "Golden edges, gooey center.", price: 48, image: "/images/cookies/image 12.jpg", category: "cookies" },
    { id: 2, name: "Double Chocolate Fudge", description: "Rich, soft, dark & milk chocolate mix.", price: 40, image: "/images/cookies/image 13.jpg", category: "cookies" },
    { id: 3, name: "Iced Matcha Latte", description: "Earthy matcha with your choice of milk.", price: 56, image: "/images/drinkss/image 12.jpg", category: "drinks" },
  ],
  cart_items: [], // { user_id, product_id, quantity }
  likes: [], // { user_id, product_id }
  orders: [], // { id, orderNumber, user_id, status, total, fulfillment, payment, contact, items, createdAt }
};

module.exports = {
  db,
  nextUserId: () => ++nextUserId,
  nextOrderId: () => ++nextOrderId,
  reset() {
    db.users = [];
    db.cart_items = [];
    db.likes = [];
    db.orders = [];
  },
};
