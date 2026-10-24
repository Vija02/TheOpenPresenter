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
/** Kept in step with fixtures/googleSlidesFixture.ts. */
const FAKE_GOOGLE_PORT = Number(process.env.FAKE_GOOGLE_PORT || 5681);
/** Kept in step with fixtures/canvaFixture.ts. */
const FAKE_CANVA_PORT = Number(process.env.FAKE_CANVA_PORT || 5682);
/** Overridable so a run can use its own server instead of the dev one. */
const APP_URL = process.env.E2E_BASE_URL || "http://localhost:5678";

/**
 * The server holds a single mock host device, so these run one at a time, in
 * one browser (they cover the host proxy, not browser behaviour).
 */
const HOST_DEVICE_SPECS = ["**/hostProjects/**/*.spec.ts"];
const NOT_PARALLEL = ["**/electron/**", ...HOST_DEVICE_SPECS];

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./tests",
  testIgnore: ["**/electron/**"],
  /* Sweeps test data left by earlier runs; workers then only clean their own */
  globalSetup: "./globalSetup.ts",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 1 : 0,
  /* Each worker owns its test data (helpers/workerData), so tests can overlap */
  workers: process.env.CI ? 3 : undefined,
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
      testIgnore: NOT_PARALLEL,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      testIgnore: NOT_PARALLEL,
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "chromium-host-device",
      testMatch: HOST_DEVICE_SPECS,
      workers: 1,
      use: { ...devices["Desktop Chrome"] },
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
      cwd: "./",
      command: "yarn fake-google",
      url: `http://localhost:${FAKE_GOOGLE_PORT}/__control/health`,
      reuseExistingServer: !process.env.CI,
    },
    {
      cwd: "./",
      command: "yarn fake-canva",
      url: `http://localhost:${FAKE_CANVA_PORT}/__control/health`,
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
        // The app id is the client id's numeric prefix
        PLUGIN_GOOGLE_SLIDES_CLIENT_ID:
          "100000000000-fake.apps.googleusercontent.com",
        PLUGIN_GOOGLE_SLIDES_CLIENT_SECRET: "fake-google-secret",
        PLUGIN_GOOGLE_SLIDES_API_URL: `http://localhost:${FAKE_GOOGLE_PORT}`,
        PLUGIN_SLIDES_CANVA_CLIENT_ID: "fake-canva-client",
        PLUGIN_SLIDES_CANVA_CLIENT_SECRET: "fake-canva-secret",
        PLUGIN_SLIDES_CANVA_API_URL: `http://localhost:${FAKE_CANVA_PORT}`,
      },
    },
  ],
});
