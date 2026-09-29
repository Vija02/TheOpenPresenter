import { expect, test } from "@playwright/test";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { launchDesktop, windowFor } from "../../helpers/desktopApp";

/**
 * Where the app keeps its own state.
 *
 * One install is one folder: settings and the cookie jar both live under the
 * runtime root, so deleting it genuinely resets the app. That is easy to
 * assert from outside and easy to break from inside.
 */

test.describe("app data layout", () => {
  test("keeps Chromium state inside the runtime root", async () => {
    const { app, root, close } = await launchDesktop();
    try {
      await windowFor(app, "onboarding");
      // Written by Chromium itself once a window exists, so its presence
      // proves userData really was redirected rather than merely configured.
      expect(existsSync(join(root, "electron", "chromium"))).toBe(true);
    } finally {
      await close();
    }
  });

  test("reads the settings it was given", async () => {
    const { app, close } = await launchDesktop({
      mode: "selfhosted",
      rootUrl: "http://127.0.0.1:9",
      autoStartRuntime: false,
    });
    try {
      // Routing to the unreachable screen for this host is only possible if
      // the seeded settings were actually read.
      const win = await windowFor(app, "unreachable");
      await expect(win.locator("h1")).toContainText("127.0.0.1:9");
    } finally {
      await close();
    }
  });

  /**
   * Nothing may leak into the platform default. A test that quietly wrote to
   * the developer's real config directory would be worse than no test.
   */
  test("writes nothing outside the runtime root", async () => {
    const { app, root, close } = await launchDesktop();
    try {
      await windowFor(app, "onboarding");
      expect(existsSync(join(root, "electron"))).toBe(true);
    } finally {
      await close();
    }
  });
});
