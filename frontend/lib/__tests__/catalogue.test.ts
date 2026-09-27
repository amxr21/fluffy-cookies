// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getMenu } from "@/lib/catalogue";

const fetchMock = vi.fn();

const menuBody = {
  data: [
    {
      id: "cat-cookies",
      title: "Cookies",
      slug: "cookies",
      items: [
        {
          id: "prod-1",
          slug: "classic-chocolate-chip",
          name: "Classic Chocolate Chip",
          description: "Golden edges.",
          price: "48.00",
          image: null,
          stock: 5,
          inStock: true,
          category: { id: "cat-cookies", name: "Cookies", slug: "cookies" },
        },
      ],
    },
  ],
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("API_ORIGIN", "http://dashboard.test");
  vi.stubEnv("DASHBOARD_API_KEY", "adk_test");
  vi.stubEnv("DASHBOARD_BRANCH_ID", "branch_main");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("getMenu", () => {
  it("reads the branch's menu with the integration key and maps it", async () => {
    fetchMock.mockResolvedValue(json(menuBody));
    const { categories, live } = await getMenu();

    const [url, init] = fetchMock.mock.calls[0] as [URL, { headers: Record<string, string> }];
    expect(String(url)).toBe("http://dashboard.test/api/v1/public/products/menu?branchId=branch_main");
    expect(init.headers["x-api-key"]).toBe("adk_test");
    expect(live).toBe(true);
    expect(categories[0].items[0]).toMatchObject({
      id: "classic-chocolate-chip",
      productId: "prod-1",
      priceMinor: 4800,
    });
  });

  it("is unavailable, never a stale list, when the dashboard is not configured", async () => {
    vi.stubEnv("DASHBOARD_API_KEY", "");
    expect(await getMenu()).toEqual({ categories: [], live: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is unavailable when the dashboard answers with an error", async () => {
    fetchMock.mockResolvedValue(json({ error: { code: "UNAUTHORIZED" } }, 401));
    expect(await getMenu()).toEqual({ categories: [], live: false });
  });

  it("is unavailable when the dashboard cannot be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    expect(await getMenu()).toEqual({ categories: [], live: false });
  });

  it("is unavailable when no branch can be chosen", async () => {
    vi.stubEnv("DASHBOARD_BRANCH_ID", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValue(json({ data: [{ id: "a" }, { id: "b" }] }));
    expect(await getMenu()).toEqual({ categories: [], live: false });
  });

  it("treats a malformed body as an empty live menu", async () => {
    fetchMock.mockResolvedValue(json({ data: "nope" }));
    expect(await getMenu()).toEqual({ categories: [], live: true });
  });
});
