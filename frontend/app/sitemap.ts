import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";
import { getMenu } from "@/lib/catalogue";

export const revalidate = 60;

/**
 * Sitemap.
 *
 * Only pages worth indexing. Cart, checkout, order-success, my-orders, liked
 * and track-order are all per-visitor or transactional — indexing them offers a
 * searcher nothing and can surface a stale page for a query it cannot answer.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes: Array<[string, MetadataRoute.Sitemap[number]["changeFrequency"], number]> = [
    ["", "weekly", 1],
    ["/menu", "weekly", 0.9],
    ["/services", "monthly", 0.8],
    ["/about", "monthly", 0.6],
    ["/shipping-policy", "yearly", 0.3],
    ["/returns", "yearly", 0.3],
    ["/allergens", "yearly", 0.4],
    ["/terms", "yearly", 0.2],
    ["/privacy-policy", "yearly", 0.2],
  ];

  const lastModified = new Date();
  const { categories } = await getMenu();
  const slugs = new Set(categories.flatMap((category) => category.items.map((item) => item.id)));
  for (const slug of slugs) {
    if (/^[a-z0-9-]+$/.test(slug)) routes.push([`/menu/${slug}`, "weekly", 0.7]);
  }

  return routes.map(([path, changeFrequency, priority]) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
