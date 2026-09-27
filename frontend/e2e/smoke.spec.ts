import { expect, test, type Page } from "@playwright/test";

/**
 * Every public route renders in the production build.
 *
 * What counts as broken here: a non-200 document, or an uncaught exception in
 * the page. Failed XHRs are not counted — the mock does not serve every call.
 */
const ROUTES = [
  "/",
  "/about",
  "/services",
  "/menu",
  "/menu/classic-chocolate-chip",
  "/cart",
  "/checkout",
  "/liked",
  "/my-orders",
  "/track-order",
  "/order-success",
  "/privacy-policy",
  "/terms",
  "/returns",
  "/shipping-policy",
  "/allergens",
];

function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  return errors;
}

for (const route of ROUTES) {
  test(`${route} renders without errors`, async ({ page }) => {
    const errors = collectPageErrors(page);
    const response = await page.goto(route, { waitUntil: "networkidle" });
    expect(response?.status()).toBe(200);
    expect(errors).toEqual([]);
  });
}

test("an unknown product is a 404 page, not a crash", async ({ page }) => {
  const response = await page.goto("/menu/not-a-real-product");
  expect(response?.status()).toBe(404);
});

test.describe("content", () => {
  // Scroll reveals keep below-the-fold content hidden until it is scrolled to;
  // Reveal shows everything at once under reduced motion, which is also the
  // path an accessibility setting takes.
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("the menu shows the dashboard's products and marks sold-out items", async ({ page }) => {
    await page.goto("/menu", { waitUntil: "networkidle" });
    await expect(page.getByText("Classic Chocolate Chip").filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText("Iced Spanish Latte").filter({ visible: true }).first()).toBeVisible();
    await page.goto("/menu/salted-caramel", { waitUntil: "networkidle" });
    // Every "Sold out" button on the page must refuse the sale, and no
    // "Add to cart" may be offered for the item.
    const soldOut = page.getByRole("button", { name: "Sold out", exact: true });
    await expect(soldOut.first()).toBeVisible();
    for (const button of await soldOut.all()) await expect(button).toBeDisabled();
    await expect(page.getByRole("button", { name: /add to cart/i })).toHaveCount(0);
  });

  test("a guest can add to cart and see it at checkout", async ({ page }) => {
    await page.goto("/menu/classic-chocolate-chip", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /add to cart/i }).first().click();
    await page.goto("/checkout", { waitUntil: "networkidle" });
    await expect(page.getByText("Classic Chocolate Chip").filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /place order/i })).toBeEnabled();
  });
});

test.describe("at phone width", () => {
  test.use({ viewport: { width: 360, height: 780 } });

  for (const route of ROUTES) {
    test(`${route} does not scroll sideways`, async ({ page }) => {
      // Known bug FX-09: the footer lays three columns side by side on mobile
      // (Footer.tsx uses grid-cols classes on a flex container). test.fail()
      // keeps CI green while it is open and turns red the moment it is fixed,
      // so the fix PR must delete this line.
      test.fail(true, "FX-09: footer overflows at 360px");
      await page.goto(route, { waitUntil: "networkidle" });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
