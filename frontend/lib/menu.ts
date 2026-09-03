/** Menu data — grouped by category. Presentational only for now;
 *  swap for an API source once the admin backend is wired. */

export type MenuItem = {
  /** Slug — used for routing/keys in the UI. */
  id: string;
  /** Numeric id the API expects for cart/order writes. The backend validates
   *  product_id with `z.coerce.number()`, so a slug arrives as NaN and the
   *  request is rejected. Keep in sync with backend/fileStore.js. */
  productId: number;
  name: string;
  description: string;
  image: string;
  price: number;
};

export type MenuCategory = {
  id: string;
  title: string;
  subtitle: string;
  items: MenuItem[];
};

export const MENU: MenuCategory[] = [
  {
    id: "cookies",
    title: "Cookies",
    subtitle: "Our cookies are baked fresh daily using real butter, Belgian chocolate, and zero shortcuts.",
    items: [
      {
        id: "classic-chocolate-chip",
        /** Backend product id — must match backend/fileStore.js. */
        productId: 1,
        name: "Classic Chocolate Chip",
        description: "Golden edges, gooey center, packed with chips.",
        image: "/images/cookies/image 12.jpg",
        price: 48,
      },
      {
        id: "double-chocolate-fudge",
        /** Backend product id — must match backend/fileStore.js. */
        productId: 2,
        name: "Double Chocolate Fudge",
        description: "Rich, soft, dark & milk chocolate mix.",
        image: "/images/cookies/image 13.jpg",
        price: 40,
      },
      {
        id: "brownie-stuffed-cookie",
        /** Backend product id — must match backend/fileStore.js. */
        productId: 3,
        name: "Brownie Stuffed Cookie",
        description: "Soft cookie dough with a molten brownie core.",
        image: "/images/cookies/image 14.jpg",
        price: 45,
      },
      {
        id: "lotus-bomb",
        /** Backend product id — must match backend/fileStore.js. */
        productId: 4,
        name: "Lotus Bomb",
        description: "Caramelized cookie base with Biscoff drizzle.",
        image: "/images/cookies/image 15.jpg",
        price: 42,
      },
      {
        id: "nutella-heart",
        /** Backend product id — must match backend/fileStore.js. */
        productId: 5,
        name: "Nutella Heart",
        description: "Vanilla dough with a Nutella center, topped with sea salt.",
        image: "/images/cookies/image 16.jpg",
        price: 44,
      },
      {
        id: "oreo-chunk",
        /** Backend product id — must match backend/fileStore.js. */
        productId: 6,
        name: "Oreo Chunk",
        description: "Cookie & cream fusion with Oreo bits throughout.",
        image: "/images/cookies/image 17.jpg",
        price: 42,
      },
    ],
  },
  {
    id: "stuffed-gourmet-sweets",
    title: "Stuffed & Gourmet Sweets",
    subtitle: "Elevated, indulgent, and made to wow.",
    items: [
      {
        id: "cookie-sandwiches",
        /** Backend product id — must match backend/fileStore.js. */
        productId: 7,
        name: "Cookie Sandwiches",
        description: "Two cookies filled with vanilla or chocolate cream.",
        image: "/images/sweets/image 12.jpg",
        price: 38,
      },
      {
        id: "brookies",
        /** Backend product id — must match backend/fileStore.js. */
        productId: 8,
        name: "Brookies",
        description: "Brownie + cookie layered squares, crispy top, chewy inside.",
        image: "/images/sweets/image 13.jpg",
        price: 40,
      },
      {
        id: "choco-dipped-treats",
        /** Backend product id — must match backend/fileStore.js. */
        productId: 9,
        name: "Choco-Dipped Treats",
        description: "Dipped cookies or mini marshmallows, rotating flavors.",
        image: "/images/sweets/image 14.jpg",
        price: 46,
      },
      {
        id: "mini-cookie-box",
        /** Backend product id — must match backend/fileStore.js. */
        productId: 10,
        name: "Mini Cookie Box",
        description: "Bite-sized assorted cookies, perfect for sharing.",
        image: "/images/sweets/image 15.jpg",
        price: 60,
      },
    ],
  },
  {
    id: "specialty-drinks",
    title: "Specialty Drinks",
    subtitle: "Sweet, smooth, and made to pair with your cookie box.",
    items: [
      {
        id: "iced-matcha-latte",
        /** Backend product id — must match backend/fileStore.js. */
        productId: 11,
        name: "Iced Matcha Latte",
        description: "Earthy matcha with your choice of milk.",
        image: "/images/drinkss/image 12.jpg",
        price: 56,
      },
      {
        id: "strawberry-matcha-swirl",
        /** Backend product id — must match backend/fileStore.js. */
        productId: 12,
        name: "Strawberry Matcha Swirl",
        description: "Layered with real strawberry purée.",
        image: "/images/drinkss/image 13.jpg",
        price: 58,
      },
      {
        id: "berry-cloud",
        /** Backend product id — must match backend/fileStore.js. */
        productId: 13,
        name: "Berry Cloud",
        description: "Strawberry, blueberry, banana & oat milk.",
        image: "/images/drinkss/image 14.jpg",
        price: 54,
      },
      {
        id: "iced-spanish-latte",
        /** Backend product id — must match backend/fileStore.js. */
        productId: 14,
        name: "Iced Spanish Latte",
        description: "Espresso, sweet milk, vanilla notes.",
        image: "/images/drinkss/image 15.jpg",
        price: 50,
      },
      {
        id: "caramel-cloud-latte",
        /** Backend product id — must match backend/fileStore.js. */
        productId: 15,
        name: "Caramel Cloud Latte",
        description: "Smooth espresso with whipped caramel foam.",
        image: "/images/drinkss/image 16.jpg",
        price: 52,
      },
      {
        id: "vanilla-iced-latte",
        /** Backend product id — must match backend/fileStore.js. */
        productId: 16,
        name: "Vanilla Iced Latte",
        description: "Chilled espresso with vanilla-infused sweet milk.",
        image: "/images/drinkss/image 17.jpg",
        price: 48,
      },
    ],
  },
];
