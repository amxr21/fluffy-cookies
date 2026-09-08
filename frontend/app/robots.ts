import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

/**
 * robots.txt.
 *
 * The disallow list is not a security control — anything genuinely private is
 * protected by auth, not by asking crawlers nicely. It exists so crawl budget
 * goes to pages that can rank, and so a per-customer page never turns up in
 * search results.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/cart", "/checkout", "/order-success", "/my-orders", "/liked", "/track-order"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
