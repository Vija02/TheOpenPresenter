import { expect, test } from "@playwright/test";

import { launchDesktop, windowFor } from "../../helpers/desktopApp";

/**
 * What the app shows on launch, for each state it can start in.
 *
 * This is where the real bugs have been: a hidden window keeping the process
 * alive, a window swap that quit the app mid-launch, and a dead server the
 * app navigated to anyway. All of them looked fine in unit tests.
 */

test.describe("startup routing", () => {
  test("shows onboarding when nothing is configured", async () => {
    const { app, close } = await launchDesktop();
    try {
      const win = await windowFor(app, "onboarding");
      await expect(win.locator("body")).toBeVisible();
    } finally {
      await close();
    }
  });

  /**
   * The instance is configured but not running. Navigating to it would show a
   * browser error page inside the app window with no way out, so the app has
   * its own screen for this.
   */
  test("explains an unreachable instance instead of navigating to it", async () => {
    const { app, close } = await launchDesktop({
      mode: "selfhosted",
      // Port 9 (discard) is reliably closed rather than merely unlikely.
      rootUrl: "http://127.0.0.1:9",
      autoStartRuntime: false,
    });
    try {
      const win = await windowFor(app, "unreachable");

      await expect(win.locator("h1")).toContainText("Can't reach");
      await expect(win.locator("h1")).toContainText("127.0.0.1:9");

      // A dead end is only acceptable if it offers a way forward.
      await expect(
        win.getByRole("button", { name: "Try again" }),
      ).toBeVisible();
      await expect(
        win.getByRole("button", { name: "Open settings" }),
      ).toBeVisible();
    } finally {
      await close();
    }
  });

  /** The address is shown so a wrong one can be recognised as wrong. */
  test("names the instance it could not reach", async () => {
    const { app, close } = await launchDesktop({
      mode: "selfhosted",
      rootUrl: "http://127.0.0.1:9",
      autoStartRuntime: false,
    });
    try {
      const win = await windowFor(app, "unreachable");
      await expect(win.locator(".mono")).toContainText("http://127.0.0.1:9");
    } finally {
      await close();
    }
  });

  /**
   * Regression: startup swaps one window for another, and the count touching
   * zero between them used to fire `window-all-closed` and quit the app
   * before the replacement appeared.
   */
  test("survives the loading-to-destination window swap", async () => {
    const { app, close } = await launchDesktop({
      mode: "selfhosted",
      rootUrl: "http://127.0.0.1:9",
      autoStartRuntime: false,
    });
    try {
      await windowFor(app, "unreachable");
      // Still alive a beat later, rather than quitting once loading closed.
      await new Promise((resolve) => setTimeout(resolve, 2000));
      expect(app.windows().length).toBeGreaterThan(0);
    } finally {
      await close();
    }
  });
});
