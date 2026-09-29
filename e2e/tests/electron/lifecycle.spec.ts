import { expect, test } from "@playwright/test";

import { launchDesktop, windowFor } from "../../helpers/desktopApp";

/**
 * Closing the app really closes it.
 *
 * Regression: a hidden main window was created eagerly at startup and never
 * closed, so `window-all-closed` never fired. Closing onboarding left the
 * process running with nothing on screen and no way back to it.
 */

test.describe("app lifecycle", () => {
  test("quits when the last window is closed", async () => {
    const { app, close } = await launchDesktop();
    try {
      const win = await windowFor(app, "onboarding");

      // Nothing invisible should be holding the app open behind this.
      expect(app.windows().length).toBe(1);

      const exited = app.waitForEvent("close", { timeout: 20_000 });
      await win.close();
      await exited;
    } finally {
      await close();
    }
  });

  test("quits when the unreachable screen is closed", async () => {
    const { app, close } = await launchDesktop({
      mode: "selfhosted",
      rootUrl: "http://127.0.0.1:9",
      autoStartRuntime: false,
    });
    try {
      const win = await windowFor(app, "unreachable");
      const exited = app.waitForEvent("close", { timeout: 20_000 });
      await win.close();
      await exited;
    } finally {
      await close();
    }
  });
});
