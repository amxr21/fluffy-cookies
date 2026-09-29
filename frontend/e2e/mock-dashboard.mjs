/**
 * A stand-in for the admin dashboard's public API, for the E2E smoke suite.
 *
 * The storefront in dashboard mode renders nothing real without a dashboard, and
 * CI has no dashboard (or database) to run. This serves just the endpoints the
 * storefront calls, with a small but realistic menu, so pages render actual
 * products. It also refuses any request without the integration key, which
 * doubles as a check that the bridge sends it.
 *
 * Stateless pricing fixtures follow cart quantity and delivery selection.
 * Contract tests for the real dashboard live in the admin-dashboard repo.
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

const ZONES = [
  { id: "zoneAlAin", code: "AL_AIN", name: "Al Ain", fee: "15.00" },
  { id: "zoneAbuDhabi", code: "ABU_DHABI", name: "Abu Dhabi", fee: "25.00" },
  { id: "zoneDubai", code: "DUBAI", name: "Dubai", fee: "30.00" },
  { id: "zoneSharjah", code: "SHARJAH", name: "Sharjah", fee: "30.00" },
  { id: "zoneNorthern", code: "NORTHERN", name: "Northern Emirates", fee: "40.00" },
].map((zone, sortOrder) => ({ ...zone, freeDeliveryThreshold: "150.00", isActive: true, sortOrder }));

function pricing(body) {
  if (body.discountCode && body.discountCode !== "TEN10") {
    return [400, { error: { code: "BAD_REQUEST", message: "This promo code cannot be applied" } }];
  }
  const products = MENU.flatMap(category => category.items);
  const lines = (body.items ?? []).map(item => {
    const product = products.find(product => product.id === item.productId);
    if (!product || !product.inStock) throw new Error("Unknown/unavailable mock product");
    const quantity = Number(item.quantity);
    return { productId: product.id, variantId: null, name: product.name, quantity, price: product.price, lineTotal: (Number(product.price) * quantity).toFixed(2) };
  });
  const subtotal = lines.reduce((sum, line) => sum + Math.round(Number(line.lineTotal) * 100), 0);
  const discount = body.discountCode === "TEN10" ? Math.round(subtotal * 0.1) : 0;
  const delivery = String(body.fulfillment ?? "Pickup").toUpperCase() === "DELIVERY";
  const zone = delivery ? ZONES.find(zone => zone.id === body.deliveryZoneId) : null;
  if (delivery && !zone) return [400, { error: { code: "BAD_REQUEST", message: "Choose a delivery area" } }];
  const fee = zone && subtotal - discount < Math.round(Number(zone.freeDeliveryThreshold) * 100) ? Math.round(Number(zone.fee) * 100) : 0;
  const total = subtotal - discount + fee;
  const decimal = minor => (minor / 100).toFixed(2);
  return [200, { data: {
    lines, subtotal: decimal(subtotal), discountCode: body.discountCode || null,
    discountAmount: decimal(discount), taxAmount: decimal(total - Math.round(total / 1.05)),
    total: decimal(total), pricesIncludeTax: true, deliveryFee: decimal(fee),
    deliveryZoneName: zone?.name ?? null,
  } }];
}

const routes = {
  "GET /api/v1/public/branches": () => [200, { data: [{ id: "e2e_branch", name: "Main" }] }],
  "GET /api/v1/public/config": () => [200, { data: { currency: "AED", taxRatePercent: 5, pricesIncludeTax: true, storeName: "Fluffy" } }],
  "GET /api/v1/public/delivery-zones": () => [200, { data: ZONES }],
  "GET /api/v1/public/products/menu": () => [200, { data: MENU }],
  "GET /api/v1/public/me": () => [401, { error: { code: "UNAUTHORIZED", message: "Please sign in to continue" } }],
  "GET /api/v1/public/orders/track": () => [404, { error: { code: "NOT_FOUND", message: "No order found with that reference and phone number" } }],
  "POST /api/v1/public/orders/quote": pricing,
  "POST /api/v1/public/orders": body => {
    const [status, response] = pricing(body);
    if (status !== 200) return [status, response];
    // Same fields as the real CheckoutResult: no lines, fulfillment or delivery.
    const { subtotal, discountAmount, taxAmount, total } = response.data;
    return [201, { data: { orderNumber: "ORD-1001-E2E001", subtotal, discountAmount, taxAmount, total } }];
  },
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
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try { send(...route(body ? JSON.parse(body) : {})); }
      catch { send(400, { error: { code: "BAD_REQUEST", message: "Invalid JSON" } }); }
    });
  })
  // No startup log: Playwright's webServer polls the URL to know it is up.
  .listen(PORT, "127.0.0.1");
