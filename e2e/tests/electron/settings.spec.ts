import { expect, test } from "@playwright/test";

import { launchDesktop, windowFor } from "../../helpers/desktopApp";

/**
 * The settings window, reached from a screen that has no menu of its own.
 *
 * Also covers the section switching that used to need two clicks: the window
 * read its hash once at load, so asking for a different section while it was
 * open left the previous one on screen.
 */

test.describe("settings window", () => {
  test("opens from the unreachable screen", async () => {
    const { app, close } = await launchDesktop({
      mode: "selfhosted",
      rootUrl: "http://127.0.0.1:9",
      autoStartRuntime: false,
    });
    try {
      const unreachable = await windowFor(app, "unreachable");
      await unreachable.getByRole("button", { name: "Open settings" }).click();

      const settings = await windowFor(app, "panel");
      await expect(settings.locator("h2")).toBeVisible();
    } finally {
      await close();
    }
  });

  test("lists every section", async () => {
    const { app, close } = await launchDesktop({
      mode: "selfhosted",
      rootUrl: "http://127.0.0.1:9",
      autoStartRuntime: false,
    });
    try {
      const unreachable = await windowFor(app, "unreachable");
      await unreachable.getByRole("button", { name: "Open settings" }).click();
      const settings = await windowFor(app, "panel");

      const nav = settings.locator(".settings-nav-item");
      await expect(nav).toHaveCount(4);
      await expect(nav.nth(0)).toContainText("Account");
      await expect(nav.nth(1)).toContainText("Local runtime");
      await expect(nav.nth(2)).toContainText("Remote access");
      await expect(nav.nth(3)).toContainText("About");
    } finally {
      await close();
    }
  });

  test("switches section on the first click", async () => {
    const { app, close } = await launchDesktop({
      mode: "selfhosted",
      rootUrl: "http://127.0.0.1:9",
      autoStartRuntime: false,
    });
    try {
      const unreachable = await windowFor(app, "unreachable");
      await unreachable.getByRole("button", { name: "Open settings" }).click();
      const settings = await windowFor(app, "panel");

      await expect(settings.locator("h2")).toContainText("Account");

      await settings
        .locator(".settings-nav-item", { hasText: "About" })
        .click();
      await expect(settings.locator(".about")).toBeVisible();

      await settings
        .locator(".settings-nav-item", { hasText: "Remote access" })
        .click();
      await expect(settings.locator("h2")).toContainText("Remote access");
    } finally {
      await close();
    }
  });
});
