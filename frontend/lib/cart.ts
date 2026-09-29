/** Cart types. State lives in context/CartContext.tsx. */

export type CartLine = {
  /** Slug — stable key for UI state and localStorage. */
  id: string;
  /** The dashboard product id (see lib/menu.ts). */
  productId: string;
  name: string;
  description: string;
  /** VAT-inclusive unit price in minor units (fils). */
  priceMinor: number;
  currency: string;
  quantity: number;
  image: string;
};

export type Fulfillment = "Pickup" | "Delivery";
