import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration for Nautilus Web Interface.
 *
 * Prerequisites:
 *   npm install -D @playwright/test
 *   npx playwright install chromium
 *
 * Run all tests:
 *   npx playwright test
 *
 * Run with UI:
 *   npx playwright test --ui
 *
 * Run specific file:
 *   npx playwright test e2e/tests/adapters.spec.ts
 */

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false, // run sequentially to avoid DB conflicts
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],

  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:8000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    headless: true,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Start the backend server before running tests (optional — comment out if running manually)
  // webServer: {
  //   command: "cd ../backend && uvicorn nautilus_fastapi:app --port 8000",
  //   port: 8000,
  //   reuseExistingServer: true,
  //   timeout: 30_000,
  // },
});
