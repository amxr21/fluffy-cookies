/**
 * In-memory data store used when USE_FILE_DATA=true (CI / no-DB testing).
 * Seeded with a small fixed dataset so integration tests (auth, cart, orders)
 * can run without MySQL. Not for production — volatile, single-process.
 */

let nextUserId = 100;
let nextOrderId = 1000;

const db = {
  users: [],
  // Seeded from frontend/lib/menu.ts — ids here are the contract the
  // storefront sends as product_id. Keep both in sync.
  products: [
    { id: 1, slug: "classic-chocolate-chip", name: "Classic Chocolate Chip", description: "Golden edges, gooey center, packed with chips.", price_minor: 4800, currency: "AED", image: "/images/cookies/image 12.jpg", category: "cookies" },
    { id: 2, slug: "double-chocolate-fudge", name: "Double Chocolate Fudge", description: "Rich, soft, dark & milk chocolate mix.", price_minor: 4000, currency: "AED", image: "/images/cookies/image 13.jpg", category: "cookies" },
    { id: 3, slug: "brownie-stuffed-cookie", name: "Brownie Stuffed Cookie", description: "Soft cookie dough with a molten brownie core.", price_minor: 4500, currency: "AED", image: "/images/cookies/image 14.jpg", category: "cookies" },
    { id: 4, slug: "lotus-bomb", name: "Lotus Bomb", description: "Caramelized cookie base with Biscoff drizzle.", price_minor: 4200, currency: "AED", image: "/images/cookies/image 15.jpg", category: "cookies" },
    { id: 5, slug: "nutella-heart", name: "Nutella Heart", description: "Vanilla dough with a Nutella center, topped with sea salt.", price_minor: 4400, currency: "AED", image: "/images/cookies/image 16.jpg", category: "cookies" },
    { id: 6, slug: "oreo-chunk", name: "Oreo Chunk", description: "Cookie & cream fusion with Oreo bits throughout.", price_minor: 4200, currency: "AED", image: "/images/cookies/image 17.jpg", category: "cookies" },
    { id: 7, slug: "cookie-sandwiches", name: "Cookie Sandwiches", description: "Two cookies filled with vanilla or chocolate cream.", price_minor: 3800, currency: "AED", image: "/images/sweets/image 12.jpg", category: "stuffed-gourmet-sweets" },
    { id: 8, slug: "brookies", name: "Brookies", description: "Brownie + cookie layered squares, crispy top, chewy inside.", price_minor: 4000, currency: "AED", image: "/images/sweets/image 13.jpg", category: "stuffed-gourmet-sweets" },
    { id: 9, slug: "choco-dipped-treats", name: "Choco-Dipped Treats", description: "Dipped cookies or mini marshmallows, rotating flavors.", price_minor: 4600, currency: "AED", image: "/images/sweets/image 14.jpg", category: "stuffed-gourmet-sweets" },
    { id: 10, slug: "mini-cookie-box", name: "Mini Cookie Box", description: "Bite-sized assorted cookies, perfect for sharing.", price_minor: 6000, currency: "AED", image: "/images/sweets/image 15.jpg", category: "stuffed-gourmet-sweets" },
    { id: 11, slug: "iced-matcha-latte", name: "Iced Matcha Latte", description: "Earthy matcha with your choice of milk.", price_minor: 5600, currency: "AED", image: "/images/drinkss/image 12.jpg", category: "specialty-drinks" },
    { id: 12, slug: "strawberry-matcha-swirl", name: "Strawberry Matcha Swirl", description: "Layered with real strawberry purée.", price_minor: 5800, currency: "AED", image: "/images/drinkss/image 13.jpg", category: "specialty-drinks" },
    { id: 13, slug: "berry-cloud", name: "Berry Cloud", description: "Strawberry, blueberry, banana & oat milk.", price_minor: 5400, currency: "AED", image: "/images/drinkss/image 14.jpg", category: "specialty-drinks" },
    { id: 14, slug: "iced-spanish-latte", name: "Iced Spanish Latte", description: "Espresso, sweet milk, vanilla notes.", price_minor: 5000, currency: "AED", image: "/images/drinkss/image 15.jpg", category: "specialty-drinks" },
    { id: 15, slug: "caramel-cloud-latte", name: "Caramel Cloud Latte", description: "Smooth espresso with whipped caramel foam.", price_minor: 5200, currency: "AED", image: "/images/drinkss/image 16.jpg", category: "specialty-drinks" },
    { id: 16, slug: "vanilla-iced-latte", name: "Vanilla Iced Latte", description: "Chilled espresso with vanilla-infused sweet milk.", price_minor: 4800, currency: "AED", image: "/images/drinkss/image 17.jpg", category: "specialty-drinks" },
  ],
  cart_items: [], // { user_id, product_id, quantity }
  likes: [], // { user_id, product_id }
  order_idempotency: [], // { idempotency_key, user_id, order_id }
  orders: [], // { id, orderNumber, user_id, status, totalMinor, currency, fulfillment, payment, contact, items, createdAt }
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
