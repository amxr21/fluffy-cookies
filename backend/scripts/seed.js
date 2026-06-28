/** Seed the products table from the storefront's menu data. */
const mysql = require("mysql2/promise");
const config = require("../config");

// Mirror of the frontend menu (lib/menu.ts). Keep in sync when the menu changes.
const PRODUCTS = [
  ["Classic Chocolate Chip", "Golden edges, gooey center, packed with chips.", 48, "/images/cookies/image 12.jpg", "cookies"],
  ["Double Chocolate Fudge", "Rich, soft, dark & milk chocolate mix.", 40, "/images/cookies/image 13.jpg", "cookies"],
  ["Brownie Stuffed Cookie", "Soft cookie dough with a molten brownie core.", 45, "/images/cookies/image 14.jpg", "cookies"],
  ["Lotus Bomb", "Caramelized cookie base with Biscoff drizzle.", 42, "/images/cookies/image 15.jpg", "cookies"],
  ["Nutella Heart", "Vanilla dough with a Nutella center, topped with sea salt.", 44, "/images/cookies/image 16.jpg", "cookies"],
  ["Oreo Chunk", "Cookie & cream fusion with Oreo bits throughout.", 42, "/images/cookies/image 17.jpg", "cookies"],
  ["Cookie Sandwiches", "Two cookies filled with vanilla or chocolate cream.", 38, "/images/sweets/image 12.jpg", "sweets"],
  ["Brookies", "Brownie + cookie layered squares, crispy top, chewy inside.", 40, "/images/sweets/image 13.jpg", "sweets"],
  ["Choco-Dipped Treats", "Dipped cookies or mini marshmallows, rotating flavors.", 46, "/images/sweets/image 14.jpg", "sweets"],
  ["Mini Cookie Box", "Bite-sized assorted cookies, perfect for sharing.", 60, "/images/sweets/image 15.jpg", "sweets"],
  ["Iced Matcha Latte", "Earthy matcha with your choice of milk.", 56, "/images/drinkss/image 12.jpg", "drinks"],
  ["Strawberry Matcha Swirl", "Layered with real strawberry puree.", 58, "/images/drinkss/image 13.jpg", "drinks"],
  ["Berry Cloud", "Strawberry, blueberry, banana & oat milk.", 54, "/images/drinkss/image 14.jpg", "drinks"],
  ["Iced Spanish Latte", "Espresso, sweet milk, vanilla notes.", 50, "/images/drinkss/image 15.jpg", "drinks"],
  ["Caramel Cloud Latte", "Smooth espresso with whipped caramel foam.", 52, "/images/drinkss/image 16.jpg", "drinks"],
  ["Vanilla Iced Latte", "Chilled espresso with vanilla-infused sweet milk.", 48, "/images/drinkss/image 17.jpg", "drinks"],
];

(async () => {
  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.name,
  });
  try {
    for (const [name, description, price, image, category] of PRODUCTS) {
      await conn.execute(
        "INSERT INTO products (name, description, price, image, category) VALUES (?, ?, ?, ?, ?)",
        [name, description, price, image, category]
      );
    }
    console.log(`✓ Seeded ${PRODUCTS.length} products`);
  } finally {
    await conn.end();
  }
})().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
