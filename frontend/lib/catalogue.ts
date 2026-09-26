import { API_URL } from "@/lib/config";
import { MENU, type MenuCategory, type MenuItem } from "@/lib/menu";

/**
 * The menu, from the API, with the static list as a fallback.
 *
 * `lib/menu.ts` was one of three hand-maintained copies of the same 16
 * products (the others being the backend's file store and its seed script),
 * each with its own `productId` that had to be kept in step by hand. The file
 * repeated "must match backend/fileStore.js" sixteen times, which is a comment
 * doing a type system's job.
 *
 * The API is now the source of truth. The static list stays as a fallback
 * rather than being deleted: a bakery whose menu page is empty because an API
 * call failed has no shop, and stale prices are caught server-side anyway —
 * every total is recomputed from the database at placement, so a wrong price
 * here is a display bug, never a wrong charge.
 */

/** What `GET /products` returns per row. */
type ApiProduct = {
  id: number;
  slug?: string;
  name: string;
  description: string;
  price_minor: number;
  currency: string;
  image: string;
  category: string;
};

/** Category ids and titles, which the products table does not carry. */
const CATEGORY_META: Record<string, { title: string; subtitle: string }> = {
  cookies: {
    title: "Cookies",
    subtitle:
      "Our cookies are baked fresh daily using real butter, Belgian chocolate, and zero shortcuts.",
  },
  "stuffed-gourmet-sweets": {
    title: "Stuffed & Gourmet Sweets",
    subtitle: "Elevated, indulgent, and made to wow.",
  },
  sweets: {
    title: "Stuffed & Gourmet Sweets",
    subtitle: "Elevated, indulgent, and made to wow.",
  },
  "specialty-drinks": {
    title: "Specialty Drinks",
    subtitle: "Sweet, smooth, and made to pair with your cookie box.",
  },
  drinks: {
    title: "Specialty Drinks",
    subtitle: "Sweet, smooth, and made to pair with your cookie box.",
  },
};

/** Order categories appear in, rather than however the database returns them. */
const CATEGORY_ORDER = ["cookies", "stuffed-gourmet-sweets", "sweets", "specialty-drinks", "drinks"];

const toMenuItem = (p: ApiProduct): MenuItem => ({
  id: p.slug ?? String(p.id),
  productId: p.id,
  name: p.name,
  description: p.description,
  image: p.image,
  priceMinor: p.price_minor,
});

/** Group flat product rows into the categories the page renders. */
export function groupIntoCategories(products: ApiProduct[]): MenuCategory[] {
  const byCategory = new Map<string, MenuItem[]>();

  for (const product of products) {
    const key = product.category || "cookies";
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key)!.push(toMenuItem(product));
  }

  return [...byCategory.entries()]
    .sort(
      ([a], [b]) =>
        (CATEGORY_ORDER.indexOf(a) + 1 || 99) - (CATEGORY_ORDER.indexOf(b) + 1 || 99)
    )
    .map(([id, items]) => ({
      id,
      title: CATEGORY_META[id]?.title ?? id,
      subtitle: CATEGORY_META[id]?.subtitle ?? "",
      items,
    }));
}

/**
 * Fetch the menu for a server component.
 *
 * Uses `fetch` directly rather than `safeFetch`, which reads auth cookies and
 * reports to a browser-only logger. Revalidates hourly: the menu changes
 * rarely, and a cached page is what keeps the storefront fast.
 *
 * Returns the static menu on any failure — never an empty page.
 */
export async function getMenu(): Promise<{ categories: MenuCategory[]; live: boolean }> {
  // Server-side rendering cannot use the relative proxy path; it needs an
  // absolute origin, and API_ORIGIN is the server's own view of the backend.
  const origin = process.env.API_ORIGIN || "";
  const base = origin ? `${origin}/api/v1` : API_URL;

  if (!base || base.startsWith("/")) {
    return { categories: MENU, live: false };
  }

  try {
    const res = await fetch(`${base}/products?limit=100`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return { categories: MENU, live: false };

    const body = (await res.json()) as { data?: ApiProduct[] };
    const rows = body?.data;
    if (!Array.isArray(rows) || rows.length === 0) {
      return { categories: MENU, live: false };
    }

    return { categories: groupIntoCategories(rows), live: true };
  } catch {
    // Network failure, malformed JSON, the backend being down — all the same
    // answer: show the menu we know rather than nothing.
    return { categories: MENU, live: false };
  }
}
