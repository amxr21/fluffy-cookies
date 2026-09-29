import { defineConfig, devices } from "@playwright/test";

/**
 * E2E smoke suite: the production build against a mock dashboard
 * (e2e/mock-dashboard.mjs). It runs `next start`, so build first:
 *
 *   pnpm build && pnpm test:e2e
 *
 * The API origin, key and branch are read at request time, so the web server
 * below points them at the mock.
 */
const PORT = 3005;
const MOCK_PORT = 4010;
const MOCK_KEY = "adk_e2e";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node e2e/mock-dashboard.mjs",
      url: `http://127.0.0.1:${MOCK_PORT}/api/v1/public/config`,
      // The mock answers 401 without a key; Playwright counts 401 as "up".
      reuseExistingServer: !process.env.CI,
      env: { MOCK_DASHBOARD_PORT: String(MOCK_PORT), MOCK_DASHBOARD_KEY: MOCK_KEY },
    },
    {
      command: `pnpm start -p ${PORT}`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        API_ORIGIN: `http://127.0.0.1:${MOCK_PORT}`,
        DASHBOARD_API_KEY: MOCK_KEY,
        DASHBOARD_BRANCH_ID: "e2e_branch",
      },
    },
  ],
});
