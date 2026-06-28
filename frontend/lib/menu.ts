/** Menu data — grouped by category. Presentational only for now;
 *  swap for an API source once the admin backend is wired. */

export type MenuItem = {
  id: string;
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
        name: "Classic Chocolate Chip",
        description: "Golden edges, gooey center, packed with chips.",
        image: "/images/cookies/image 12.jpg",
        price: 48,
      },
      {
        id: "double-chocolate-fudge",
        name: "Double Chocolate Fudge",
        description: "Rich, soft, dark & milk chocolate mix.",
        image: "/images/cookies/image 13.jpg",
        price: 40,
      },
      {
        id: "brownie-stuffed-cookie",
        name: "Brownie Stuffed Cookie",
        description: "Soft cookie dough with a molten brownie core.",
        image: "/images/cookies/image 14.jpg",
        price: 45,
      },
      {
        id: "lotus-bomb",
        name: "Lotus Bomb",
        description: "Caramelized cookie base with Biscoff drizzle.",
        image: "/images/cookies/image 15.jpg",
        price: 42,
      },
      {
        id: "nutella-heart",
        name: "Nutella Heart",
        description: "Vanilla dough with a Nutella center, topped with sea salt.",
        image: "/images/cookies/image 16.jpg",
        price: 44,
      },
      {
        id: "oreo-chunk",
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
        name: "Cookie Sandwiches",
        description: "Two cookies filled with vanilla or chocolate cream.",
        image: "/images/sweets/image 12.jpg",
        price: 38,
      },
      {
        id: "brookies",
        name: "Brookies",
        description: "Brownie + cookie layered squares, crispy top, chewy inside.",
        image: "/images/sweets/image 13.jpg",
        price: 40,
      },
      {
        id: "choco-dipped-treats",
        name: "Choco-Dipped Treats",
        description: "Dipped cookies or mini marshmallows, rotating flavors.",
        image: "/images/sweets/image 14.jpg",
        price: 46,
      },
      {
        id: "mini-cookie-box",
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
        name: "Iced Matcha Latte",
        description: "Earthy matcha with your choice of milk.",
        image: "/images/drinkss/image 12.jpg",
        price: 56,
      },
      {
        id: "strawberry-matcha-swirl",
        name: "Strawberry Matcha Swirl",
        description: "Layered with real strawberry purée.",
        image: "/images/drinkss/image 13.jpg",
        price: 58,
      },
      {
        id: "berry-cloud",
        name: "Berry Cloud",
        description: "Strawberry, blueberry, banana & oat milk.",
        image: "/images/drinkss/image 14.jpg",
        price: 54,
      },
      {
        id: "iced-spanish-latte",
        name: "Iced Spanish Latte",
        description: "Espresso, sweet milk, vanilla notes.",
        image: "/images/drinkss/image 15.jpg",
        price: 50,
      },
      {
        id: "caramel-cloud-latte",
        name: "Caramel Cloud Latte",
        description: "Smooth espresso with whipped caramel foam.",
        image: "/images/drinkss/image 16.jpg",
        price: 52,
      },
      {
        id: "vanilla-iced-latte",
        name: "Vanilla Iced Latte",
        description: "Chilled espresso with vanilla-infused sweet milk.",
        image: "/images/drinkss/image 17.jpg",
        price: 48,
      },
    ],
  },
];
