import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { NAV_LINKS, POLICY_LINKS, QUICK_LINKS, SITE_URL } from "@/lib/site";

/**
 * Every internal link points at a route that exists.
 *
 * All four policy links used to be `href: "#"` — they looked like links, did
 * nothing, and nothing caught it. This checks the href against the filesystem,
 * so adding a link without its page fails here rather than in front of a
 * customer.
 */

const APP_DIR = join(process.cwd(), "app");

/** Does `/returns` have a page.tsx behind it? */
const routeExists = (href: string) => {
  const segment = href.replace(/^\//, "");
  if (segment === "") return existsSync(join(APP_DIR, "page.tsx"));
  return existsSync(join(APP_DIR, segment, "page.tsx"));
};

const allLinks = [
  ...NAV_LINKS.map((l) => ["nav", l] as const),
  ...QUICK_LINKS.map((l) => ["quick", l] as const),
  ...POLICY_LINKS.map((l) => ["policy", l] as const),
];

describe("internal links", () => {
  it.each(allLinks)("%s link %o points at a real route", (_group, link) => {
    expect(link.href).not.toBe("#");
    expect(routeExists(link.href)).toBe(true);
  });

  it("has a policy link for each document the standard requires", () => {
    // Privacy, terms, delivery, returns and allergens are all Tier 1, and
    // allergens specifically because this is a food business.
    const hrefs = POLICY_LINKS.map((l) => l.href);
    expect(hrefs).toEqual(
      expect.arrayContaining([
        "/privacy-policy",
        "/terms",
        "/shipping-policy",
        "/returns",
        "/allergens",
      ])
    );
  });

  it("gives every link a label a person can act on", () => {
    for (const [, link] of allLinks) {
      expect(link.label.trim().length).toBeGreaterThan(2);
    }
  });
});

describe("SITE_URL", () => {
  it("is absolute, as OG tags and the sitemap require", () => {
    // A relative OG image simply does not render when a link is shared.
    expect(SITE_URL).toMatch(/^https?:\/\//);
  });

  it("carries no trailing slash, so joins do not double up", () => {
    expect(SITE_URL.endsWith("/")).toBe(false);
  });
});
