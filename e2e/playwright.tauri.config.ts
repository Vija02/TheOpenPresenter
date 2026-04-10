import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for running E2E tests against the Tauri desktop app.
 *
 * The Tauri binary must be started externally before running these tests.
 * It handles embedded PostgreSQL, migrations, worker, and server startup.
 *
 * Locally:
 *   ENABLE_E2E_COMMANDS=1 ./tauri/target/debug/TheOpenPresenter &
 *   yarn e2e test --config playwright.tauri.config.ts
 *
 * On CI this is handled by .github/workflows/playwright-tauri.yml.
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:5678",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
  ],
  // No webServer — the Tauri binary is started before Playwright runs.
  // Tauri embeds PostgreSQL, runs migrations, and starts the worker and
  // server automatically on port 5678.
});
