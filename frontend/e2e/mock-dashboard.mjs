/**
 * A stand-in for the admin dashboard's public API, for the E2E smoke suite.
 *
 * The storefront in dashboard mode renders nothing real without a dashboard, and
 * CI has no dashboard (or database) to run. This serves just the endpoints the
 * storefront calls, with a small but realistic menu, so pages render actual
 * products. It also refuses any request without the integration key, which
 * doubles as a check that the bridge sends it.
 *
 * Deliberately dumb: no state, no validation beyond the key. Contract tests for
 * the real dashboard live in the admin-dashboard repo.
 */
import http from "node:http";

const PORT = Number(process.env.MOCK_DASHBOARD_PORT || 4010);
const API_KEY = process.env.MOCK_DASHBOARD_KEY || "adk_e2e";

const category = (id, title) => ({ id, name: title, slug: id });
const product = (slug, name, price, cat, inStock = true) => ({
  id: `p_${slug}`,
  slug,
  name,
  description: `${name} — baked for the E2E suite.`,
  price,
  image: null,
  stock: inStock ? 20 : 0,
  inStock,
  category: category(cat.id, cat.title),
});

const COOKIES = { id: "cookies", title: "Cookies" };
const DRINKS = { id: "specialty-drinks", title: "Specialty Drinks" };
const MENU = [
  {
    id: COOKIES.id,
    title: COOKIES.title,
    slug: COOKIES.id,
    items: [
      product("classic-chocolate-chip", "Classic Chocolate Chip", "48.00", COOKIES),
      product("lotus-bomb", "Lotus Bomb", "42.00", COOKIES),
      product("salted-caramel", "Salted Caramel", "40.00", COOKIES, false),
    ],
  },
  {
    id: DRINKS.id,
    title: DRINKS.title,
    slug: DRINKS.id,
    items: [product("iced-spanish-latte", "Iced Spanish Latte", "52.00", DRINKS)],
  },
];

const routes = {
  "GET /api/v1/public/branches": () => [200, { data: [{ id: "e2e_branch", name: "Main" }] }],
  "GET /api/v1/public/config": () => [200, { data: { currency: "AED", taxRatePercent: 5, storeName: "Fluffy" } }],
  "GET /api/v1/public/products/menu": () => [200, { data: MENU }],
  "GET /api/v1/public/me": () => [401, { error: { code: "UNAUTHORIZED", message: "Please sign in to continue" } }],
  "GET /api/v1/public/orders/track": () => [404, { error: { code: "NOT_FOUND", message: "No order found with that reference and phone number" } }],
  "POST /api/v1/public/orders": () => [201, { data: { orderNumber: "ORD-1001-E2E001", subtotal: "48.00", discountAmount: "0.00", taxAmount: "2.40", total: "50.40" } }],
};

http
  .createServer((req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (req.headers["x-api-key"] !== API_KEY) {
      return send(401, { error: { code: "UNAUTHORIZED", message: "API key required" } });
    }
    const { pathname } = new URL(req.url, "http://mock");
    const route = routes[`${req.method} ${pathname}`];
    if (!route) return send(404, { error: { code: "NOT_FOUND", message: `No mock for ${req.method} ${pathname}` } });
    // Drain the body so POSTs complete cleanly.
    req.resume();
    req.on("end", () => send(...route()));
  })
  // No startup log: Playwright's webServer polls the URL to know it is up.
  .listen(PORT, "127.0.0.1");
