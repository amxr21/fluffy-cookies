import type { MenuCategory } from "@/lib/menu";
import { dashboardMenuToCategories, type DashboardMenuCategory } from "@/lib/dashboard";
import { dashboardBranchId, dashboardServerConfig } from "@/lib/dashboardServer";

/**
 * The menu, from the admin dashboard, for a server component.
 *
 * The dashboard is the only source of truth for what is sold: its product IDs
 * are what the cart and checkout send back. There is deliberately no static
 * fallback — a stale local list would show products the dashboard cannot sell,
 * so on any failure the page says the menu is unavailable instead.
 *
 * Uses `fetch` directly rather than `safeFetch`, which targets the browser-side
 * bridge and reports to a browser-only logger. Revalidates every minute: stock
 * and prices change during the day, and a cached page keeps the menu fast.
 */
export async function getMenu(): Promise<{ categories: MenuCategory[]; live: boolean }> {
  const config = dashboardServerConfig();
  if (!config) return { categories: [], live: false };
  try {
    const branchId = await dashboardBranchId(config);
    if (!branchId) return { categories: [], live: false };
    const url = new URL(`${config.origin}/api/v1/public/products/menu`);
    url.searchParams.set("branchId", branchId);
    const response = await fetch(url, {
      headers: { "x-api-key": config.apiKey },
      next: { revalidate: 60 },
    });
    if (!response.ok) return { categories: [], live: false };
    const body = (await response.json()) as { data?: DashboardMenuCategory[] };
    return {
      categories: dashboardMenuToCategories(Array.isArray(body.data) ? body.data : []),
      live: true,
    };
  } catch {
    return { categories: [], live: false };
  }
}
