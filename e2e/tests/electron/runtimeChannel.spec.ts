import { expect, test } from "@playwright/test";

import {
  launchDesktop,
  readSettings,
  windowFor,
} from "../../helpers/desktopApp";

/**
 * The channel picker in Settings > Local runtime.
 *
 * Onboarding was the only place a channel could be chosen, so a machine set up
 * on nightly had no way back to stable, or the other way round, short of
 * editing settings.json by hand.
 */
test.describe("runtime channel", () => {
  test("shows the stored channel and saves a change", async () => {
    const { app, root, close } = await launchDesktop({
      mode: "selfhosted",
      rootUrl: "http://127.0.0.1:9",
      autoStartRuntime: false,
      // Deliberately not the default, so the assertion below fails if the
      // stored value is never read.
      channel: "nightly",
    });
    try {
      const unreachable = await windowFor(app, "unreachable");
      await unreachable.getByRole("button", { name: "Open settings" }).click();

      const settings = await windowFor(app, "panel");
      await settings
        .locator(".settings-nav-item", { hasText: "Local runtime" })
        .click();

      const picker = settings.getByLabel("Download channel");
      await expect(picker).toHaveValue("nightly");

      await picker.selectOption("stable");
      await expect(picker).toHaveValue("stable");

      // Saved, not just shown: this is what the next check and the startup
      // refresh read.
      await expect.poll(() => readSettings(root).channel).toBe("stable");
    } finally {
      await close();
    }
  });
});
