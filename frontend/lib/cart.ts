/** Cart types + seed data. Will be replaced by CartContext (server-backed,
 *  optimistic) once the admin backend is wired — see STOREFRONT-TEMPLATE. */

export type CartLine = {
  /** Slug — stable key for UI state and localStorage. */
  id: string;
  /** Numeric id the API expects on cart/order writes (see lib/menu.ts). */
  productId: number;
  name: string;
  description: string;
  price: number;
  quantity: number;
  image: string;
};

export type Fulfillment = "Pickup" | "Delivery";

export const SEED_CART: CartLine[] = [
  {
    id: "iced-matcha-latte",
    productId: 11,
    name: "Iced Matcha Latte",
    description: "earthy matcha with your choice of milk",
    price: 56,
    quantity: 1,
    image: "/images/drinkss/image 12.jpg",
  },
  {
    id: "classic-chocolate-chip",
    productId: 1,
    name: "Classic Chocolate Chip",
    description: "golden edges, gooey center, packed with chips",
    price: 48,
    quantity: 3,
    image: "/images/cookies/image 12.jpg",
  },
  {
    id: "double-chocolate-fudge",
    productId: 2,
    name: "Double Chocolate Fudge",
    description: "rich, soft, dark & milk chocolate mix",
    price: 40,
    quantity: 2,
    image: "/images/cookies/image 13.jpg",
  },
];
