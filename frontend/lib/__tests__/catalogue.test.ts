import { describe, expect, it } from "vitest";

import { groupIntoCategories } from "@/lib/catalogue";

/**
 * Grouping API product rows into the menu's categories.
 *
 * `lib/menu.ts` was one of three hand-maintained copies of the same products,
 * each with its own `productId` kept in step by hand. The API is now the source
 * of truth; this covers the shaping between the two.
 */

const row = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 1,
  slug: "classic-chocolate-chip",
  name: "Classic Chocolate Chip",
  description: "Golden edges.",
  price_minor: 4800,
  currency: "AED",
  image: "/images/cookies/1.jpg",
  category: "cookies",
  ...over,
});

describe("groupIntoCategories", () => {
  it("groups rows under their category", () => {
    const out = groupIntoCategories([
      row({ id: 1, category: "cookies" }),
      row({ id: 2, category: "cookies" }),
      row({ id: 11, category: "drinks" }),
    ] as never);

    expect(out).toHaveLength(2);
    expect(out[0].items).toHaveLength(2);
  });

  it("orders categories deliberately, not however the database returned them", () => {
    const out = groupIntoCategories([
      row({ id: 11, category: "drinks" }),
      row({ id: 1, category: "cookies" }),
    ] as never);

    // Cookies first — it is a cookie shop.
    expect(out[0].id).toBe("cookies");
  });

  it("maps price_minor onto the card's priceMinor", () => {
    const [category] = groupIntoCategories([row({ price_minor: 5600 })] as never);
    expect(category.items[0].priceMinor).toBe(5600);
  });

  it("keeps the numeric id, which cart and order writes need", () => {
    const [category] = groupIntoCategories([row({ id: 7 })] as never);
    expect(category.items[0].productId).toBe(7);
  });

  it("falls back to the numeric id when a row has no slug", () => {
    // The products table has no slug column yet; the UI still needs a key.
    const [category] = groupIntoCategories([row({ id: 9, slug: undefined })] as never);
    expect(category.items[0].id).toBe("9");
  });

  it("gives a known category its real title", () => {
    const [category] = groupIntoCategories([row({ category: "cookies" })] as never);
    expect(category.title).toBe("Cookies");
  });

  it("does not drop a product in an unexpected category", () => {
    // A category added in the admin later must still appear, titled by its own
    // key rather than vanishing from the menu.
    const out = groupIntoCategories([row({ category: "seasonal" })] as never);
    expect(out).toHaveLength(1);
    expect(out[0].items).toHaveLength(1);
  });

  it("returns nothing for no rows rather than throwing", () => {
    expect(groupIntoCategories([])).toEqual([]);
  });
});
