import { defineConfig } from "@playwright/test";

/**
 * E2E tests for the Electron desktop shell.
 *
 * These drive the shell's own windows (onboarding, settings, the unreachable
 * screen) through Playwright's Electron support, which the other configs
 * cannot reach: `playwright.tauri.config.ts` drives the web app a desktop
 * binary serves, not the desktop chrome around it.
 *
 * No web server and no database. Every test launches the built app against a
 * throwaway runtime root, so nothing here touches a real install.
 *
 * Locally:
 *   cd native-apps/studio && npx electron-vite build
 *   yarn e2e test:electron
 */
export default defineConfig({
  testDir: "./tests/electron",
  // Each test launches its own Electron process against its own data
  // directory, so they do not contend; parallel is safe and much faster.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "list" : "html",
  // Launching Electron and waiting for a window is slower than a page load.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
});
