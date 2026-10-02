import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { launchDesktop, windowFor } from "../../helpers/desktopApp";

/**
 * The shell log.
 *
 * A packaged app has no console attached, so everything the Electron side did
 * only ever existed in memory. These lines are what a support request can be
 * answered from, and they live beside the runtime log the diagnostics bundle
 * already collects.
 */
test.describe("shell log", () => {
  test("records where startup went, inside the runtime root", async () => {
    const { app, root, close } = await launchDesktop({
      mode: "selfhosted",
      rootUrl: "http://127.0.0.1:9",
      autoStartRuntime: false,
    });
    try {
      await windowFor(app, "unreachable");

      const read = () => {
        try {
          return readFileSync(join(root, "logs", "electron.log"), "utf8");
        } catch {
          return "";
        }
      };

      await expect.poll(read).toContain("[startup]");
      // The decision, not just the banner: this is the line that says which
      // screen the app chose, which is otherwise only visible on the screen.
      expect(read()).toContain("showing the unreachable screen");
    } finally {
      await close();
    }
  });
});
