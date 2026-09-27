// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import sitemap from "@/app/sitemap";
import { getMenu } from "@/lib/catalogue";
import { SITE_URL } from "@/lib/site";

vi.mock("@/lib/catalogue", () => ({ getMenu: vi.fn() }));

describe("sitemap", () => {
  it("includes each valid product page once", async () => {
    vi.mocked(getMenu).mockResolvedValue({ live: true, categories: [{ id: "cookies", title: "Cookies", subtitle: "", items: ["classic", "classic", "../checkout"].map((id) => ({ id, productId: id, name: id, image: "", description: "", priceMinor: 100 })) }] });
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls.filter((url) => url === `${SITE_URL}/menu/classic`)).toHaveLength(1);
    expect(urls).not.toContain(`${SITE_URL}/menu/../checkout`);
    expect(urls).not.toContain(`${SITE_URL}/checkout`);
  });

  it("still returns public pages when the catalogue is unavailable", async () => {
    vi.mocked(getMenu).mockResolvedValue({ live: false, categories: [] });
    expect((await sitemap()).map((entry) => entry.url)).toContain(`${SITE_URL}/menu`);
  });
});
