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
    { id: 1, slug: "classic-chocolate-chip", name: "Classic Chocolate Chip", description: "Golden edges, gooey center, packed with chips.", price: 48, image: "/images/cookies/image 12.jpg", category: "cookies" },
    { id: 2, slug: "double-chocolate-fudge", name: "Double Chocolate Fudge", description: "Rich, soft, dark & milk chocolate mix.", price: 40, image: "/images/cookies/image 13.jpg", category: "cookies" },
    { id: 3, slug: "brownie-stuffed-cookie", name: "Brownie Stuffed Cookie", description: "Soft cookie dough with a molten brownie core.", price: 45, image: "/images/cookies/image 14.jpg", category: "cookies" },
    { id: 4, slug: "lotus-bomb", name: "Lotus Bomb", description: "Caramelized cookie base with Biscoff drizzle.", price: 42, image: "/images/cookies/image 15.jpg", category: "cookies" },
    { id: 5, slug: "nutella-heart", name: "Nutella Heart", description: "Vanilla dough with a Nutella center, topped with sea salt.", price: 44, image: "/images/cookies/image 16.jpg", category: "cookies" },
    { id: 6, slug: "oreo-chunk", name: "Oreo Chunk", description: "Cookie & cream fusion with Oreo bits throughout.", price: 42, image: "/images/cookies/image 17.jpg", category: "cookies" },
    { id: 7, slug: "cookie-sandwiches", name: "Cookie Sandwiches", description: "Two cookies filled with vanilla or chocolate cream.", price: 38, image: "/images/sweets/image 12.jpg", category: "stuffed-gourmet-sweets" },
    { id: 8, slug: "brookies", name: "Brookies", description: "Brownie + cookie layered squares, crispy top, chewy inside.", price: 40, image: "/images/sweets/image 13.jpg", category: "stuffed-gourmet-sweets" },
    { id: 9, slug: "choco-dipped-treats", name: "Choco-Dipped Treats", description: "Dipped cookies or mini marshmallows, rotating flavors.", price: 46, image: "/images/sweets/image 14.jpg", category: "stuffed-gourmet-sweets" },
    { id: 10, slug: "mini-cookie-box", name: "Mini Cookie Box", description: "Bite-sized assorted cookies, perfect for sharing.", price: 60, image: "/images/sweets/image 15.jpg", category: "stuffed-gourmet-sweets" },
    { id: 11, slug: "iced-matcha-latte", name: "Iced Matcha Latte", description: "Earthy matcha with your choice of milk.", price: 56, image: "/images/drinkss/image 12.jpg", category: "specialty-drinks" },
    { id: 12, slug: "strawberry-matcha-swirl", name: "Strawberry Matcha Swirl", description: "Layered with real strawberry purée.", price: 58, image: "/images/drinkss/image 13.jpg", category: "specialty-drinks" },
    { id: 13, slug: "berry-cloud", name: "Berry Cloud", description: "Strawberry, blueberry, banana & oat milk.", price: 54, image: "/images/drinkss/image 14.jpg", category: "specialty-drinks" },
    { id: 14, slug: "iced-spanish-latte", name: "Iced Spanish Latte", description: "Espresso, sweet milk, vanilla notes.", price: 50, image: "/images/drinkss/image 15.jpg", category: "specialty-drinks" },
    { id: 15, slug: "caramel-cloud-latte", name: "Caramel Cloud Latte", description: "Smooth espresso with whipped caramel foam.", price: 52, image: "/images/drinkss/image 16.jpg", category: "specialty-drinks" },
    { id: 16, slug: "vanilla-iced-latte", name: "Vanilla Iced Latte", description: "Chilled espresso with vanilla-infused sweet milk.", price: 48, image: "/images/drinkss/image 17.jpg", category: "specialty-drinks" },
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
