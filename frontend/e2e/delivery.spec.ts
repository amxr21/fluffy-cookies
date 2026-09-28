import { expect, test, type Page } from "@playwright/test";

test.use({ contextOptions: { reducedMotion: "reduce" } });

async function checkout(page: Page, quantity = 1) {
  // A guest cart lets these cases isolate pricing/fulfillment instead of repeating
  // product-page interactions already covered by smoke.spec.ts.
  await page.addInitScript((quantity) => {
    if (window.location.pathname !== "/checkout") return;
    localStorage.setItem("fluffy_cart", JSON.stringify([{
      id: "classic-chocolate-chip", productId: "p_classic-chocolate-chip",
      name: "Classic Chocolate Chip", description: "", priceMinor: 4800,
      currency: "AED", quantity, image: "",
    }]));
  }, quantity);
  await page.goto("/checkout", { waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: /place order/i })).toBeEnabled();
}

async function select(page: Page, label: string, option: string) {
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

function summary(page: Page) {
  return page.getByRole("heading", { name: "Order Summary", exact: true }).locator("..");
}

test("delivery selects a configured fee and success shows the returned delivery total", async ({ page }) => {
  await checkout(page);
  await select(page, "Fulfillment method", "Delivery");
  await select(page, "Emirate", "Al Ain");
  await expect(summary(page)).toContainText(/Delivery · Al Ain\s*AED\s*15\.00/);
  await expect(summary(page)).toContainText(/Total\s*AED\s*63\.00/);
  await select(page, "Emirate", "Abu Dhabi");
  await expect(summary(page)).toContainText(/Delivery · Abu Dhabi\s*AED\s*25\.00/);
  await expect(summary(page)).toContainText(/Total\s*AED\s*73\.00/);
  await page.getByRole("textbox", { name: "Full name", exact: true }).fill("Delivery Shopper");
  await page.getByRole("textbox", { name: "Phone", exact: true }).fill("0501234567");
  await page.getByRole("textbox", { name: "Address", exact: true }).fill("Building 12, Test Street");
  await page.getByRole("textbox", { name: "City", exact: true }).fill("Abu Dhabi");
  await page.getByRole("button", { name: /place order/i }).click();
  await expect(page).toHaveURL(/order-success/);
  await expect(page.getByText(/prepare your order for delivery/i)).toBeVisible();
  await expect(page.getByText(/Order total:/)).toContainText(/AED\s*73\.00/);
  expect(new URL(page.url()).searchParams.get("fulfillment")).toBe("DELIVERY");
  expect(new URL(page.url()).searchParams.get("totalMinor")).toBe("7300");
  expect(page.url()).not.toContain("0501234567");
});

test("switching from delivery back to pickup removes its fee", async ({ page }) => {
  await checkout(page);
  await select(page, "Fulfillment method", "Delivery");
  await select(page, "Emirate", "Al Ain");
  await expect(summary(page)).toContainText(/Total\s*AED\s*63\.00/);
  await select(page, "Fulfillment method", "Pickup");
  await expect(summary(page)).toContainText(/Total\s*AED\s*48\.00/);
  await expect(page.getByRole("button", { name: /place order/i })).toBeEnabled();
});

test("a delivery quote failure does not block a fresh pickup quote", async ({ page }) => {
  await page.route("**/api/storefront/orders/quote", async route => {
    const body = route.request().postDataJSON() as { fulfillment?: string };
    if (body.fulfillment?.toUpperCase() === "DELIVERY") {
      await route.fulfill({ status: 503, json: { error: { code: "UNAVAILABLE", message: "Delivery pricing temporarily unavailable" } } });
    } else await route.continue();
  });
  await checkout(page);
  await select(page, "Fulfillment method", "Delivery");
  await select(page, "Emirate", "Al Ain");
  await expect(page.getByRole("alert").filter({ hasText: "Delivery pricing temporarily unavailable" })).toBeVisible();
  await expect(page.getByRole("button", { name: /place order/i })).toBeDisabled();
  await select(page, "Fulfillment method", "Pickup");
  await expect(summary(page)).toContainText(/Total\s*AED\s*48\.00/);
  await expect(page.getByRole("alert").filter({ hasText: "Delivery pricing temporarily unavailable" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /place order/i })).toBeEnabled();
});

for (const [quantity, total, fee] of [[3, "159.00", "AED 15.00"], [4, "192.00", "Free"]] as const) {
  test(`${quantity} cookies calculate delivery ${fee} at the free-delivery threshold`, async ({ page }) => {
    await checkout(page, quantity);
    await select(page, "Fulfillment method", "Delivery");
    await select(page, "Emirate", "Al Ain");
    await expect(summary(page)).toContainText(new RegExp(`Total\\s*AED\\s*${total.replace(".", "\\.")}`));
    await expect(summary(page)).toContainText(`Delivery · Al Ain${fee}`);
  });
}
