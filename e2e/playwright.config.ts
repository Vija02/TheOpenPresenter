import { defineConfig, devices } from "@playwright/test";

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/** Kept in step with fixtures/aiFixture.ts. */
const FAKE_AI_PORT = Number(process.env.FAKE_AI_PORT || 5679);
/** Kept in step with fixtures/planningCenterFixture.ts. */
const FAKE_PCO_PORT = Number(process.env.FAKE_PCO_PORT || 5680);
/** Overridable so a run can use its own server instead of the dev one. */
const APP_URL = process.env.E2E_BASE_URL || "http://localhost:5678";

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./tests",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 1 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI ? "blob" : "html",
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: APP_URL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",

    screenshot: "only-on-failure",
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },

    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },

    // ...(process.env.CI
    //   ? [
    //       {
    //         name: "webkit",
    //         use: { ...devices["Desktop Safari"] },
    //       },

    //       {
    //         name: "Microsoft Edge",
    //         use: { ...devices["Desktop Edge"], channel: "msedge" },
    //       },
    //     ]
    //   : []),

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: [
    {
      cwd: "./",
      command: "yarn fake-ai",
      url: `http://localhost:${FAKE_AI_PORT}/__control/health`,
      reuseExistingServer: !process.env.CI,
    },
    {
      cwd: "./",
      command: "yarn fake-pco",
      url: `http://localhost:${FAKE_PCO_PORT}/__control/health`,
      reuseExistingServer: !process.env.CI,
    },
    {
      cwd: "../",
      command: "yarn server start",
      url: APP_URL,
      reuseExistingServer: !process.env.CI,
      env: {
        AI_BASE_URL: `http://localhost:${FAKE_AI_PORT}/v1`,
        AI_API_KEY: "fake-e2e-key",
        AI_MODEL: "fake-model",
        PLUGIN_LYRICS_PCO_CLIENT_ID: "fake-pco-client",
        PLUGIN_LYRICS_PCO_CLIENT_SECRET: "fake-pco-secret",
        PLUGIN_LYRICS_PCO_API_URL: `http://localhost:${FAKE_PCO_PORT}`,
        PLUGIN_LYRICS_PCO_OAUTH_URL: `http://localhost:${FAKE_PCO_PORT}`,
      },
    },
  ],
});
