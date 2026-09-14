import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for running E2E tests against the Tauri desktop app.
 *
 * The Tauri binary must be started externally before running these tests.
 * It handles embedded PostgreSQL, migrations, worker, and server startup.
 *
 * Locally:
 *   yarn e2e fake-ai &
 *   yarn e2e fake-pco &
 *   ENABLE_E2E_COMMANDS=1 \
 *   AI_BASE_URL=http://localhost:5679/v1 AI_API_KEY=fake-e2e-key AI_MODEL=fake-model \
 *   PLUGIN_LYRICS_PCO_CLIENT_ID=fake-pco-client \
 *   PLUGIN_LYRICS_PCO_CLIENT_SECRET=fake-pco-secret \
 *   PLUGIN_LYRICS_PCO_API_URL=http://localhost:5680 \
 *   PLUGIN_LYRICS_PCO_OAUTH_URL=http://localhost:5680 \
 *     ./tauri/target/debug/theopenpresenter-app &
 *   yarn e2e test --config playwright.tauri.config.ts
 *
 * On CI this is handled by .github/workflows/playwright-tauri.yml.
 */
process.env.PLAYWRIGHT_TAURI = "1";

/** Kept in step with fixtures/aiFixture.ts. */
const FAKE_AI_PORT = Number(process.env.FAKE_AI_PORT || 5679);
/** Kept in step with fixtures/planningCenterFixture.ts. */
const FAKE_PCO_PORT = Number(process.env.FAKE_PCO_PORT || 5680);

export default defineConfig({
  testDir: "./tests",
  testIgnore: [
    "**/cloud/sync.spec.ts",
    "**/cloud/syncDocument.spec.ts",
    "**/hostProjects/hostProjectsDashboard.spec.ts",
    "**/hostProjects/hostProjectsProxy.spec.ts",
    "**/organization.spec.ts",
  ],
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
  ],
  webServer: [
    {
      cwd: "./",
      command: "yarn fake-ai",
      url: `http://localhost:${FAKE_AI_PORT}/__control/health`,
      reuseExistingServer: true,
    },
    {
      cwd: "./",
      command: "yarn fake-pco",
      url: `http://localhost:${FAKE_PCO_PORT}/__control/health`,
      reuseExistingServer: true,
    },
  ],
});
