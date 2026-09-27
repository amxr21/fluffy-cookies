/** Menu shapes the UI renders. Filled from the admin dashboard by
 *  lib/catalogue.ts (via the adapters in lib/dashboard.ts). */

export type MenuItem = {
  /** Slug — used for routing/keys in the UI. */
  id: string;
  /** The dashboard product id — what cart and checkout send back. */
  productId: string;
  name: string;
  description: string;
  image: string;
  /** VAT-inclusive price in minor units (fils). 4800 = AED 48.00.
   *  Integer money only — see lib/money.ts. */
  priceMinor: number;
  inStock?: boolean;
};

export type MenuCategory = {
  id: string;
  title: string;
  subtitle: string;
  items: MenuItem[];
};
