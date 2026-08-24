import { expect, test } from "../../../fixtures/clientPluginFixture";
import { sourceWithMarker, sourceWithSeed } from "./clientPluginSource";

/**
 * A client plugin doing its actual job: an operator edits it in the remote and
 * the audience sees the result on the renderer.
 *
 * Seed data is the subtle part. `manifest.ts` is authored code, so its values
 * only exist once the build evaluates it; NewScene then copies them into the
 * scene. The bug this covers is the manifest column never being written, so
 * every new scene started completely blank while the build still succeeded and
 * the plugin still loaded.
 */

test.describe("client plugin scenes", () => {
  test("carries operator edits from the remote to the renderer", async ({
    page,
    cplugin,
    projectPage,
  }) => {
    await cplugin.seedPlugin({
      label: "live",
      title: "Live Plugin",
      source: sourceWithMarker("LIVE"),
    });

    await cplugin.gotoProject();
    await cplugin.addScene("Live Plugin");

    await expect(page.getByTestId("cplugin-marker")).toHaveText("LIVE", {
      timeout: 60_000,
    });

    await page.getByTestId("cplugin-title").fill("Typed by the operator");
    await page.getByRole("button", { name: /Go live|Showing/ }).click();

    // The renderer loads its own bundle of the same version, so this is where a
    // renderer-only build or registration failure shows up.
    const renderer = await projectPage.present();
    await expect(renderer.getByTestId("cplugin-renderer-marker")).toHaveText(
      "LIVE",
      { timeout: 60_000 },
    );
    await expect(renderer.getByTestId("cplugin-renderer-title")).toHaveText(
      "Typed by the operator",
    );

    // Still live: a later edit reaches the renderer without a reload.
    await page.getByTestId("cplugin-title").fill("Edited while live");
    await expect(renderer.getByTestId("cplugin-renderer-title")).toHaveText(
      "Edited while live",
    );
  });

  test("prefills a new scene from the manifest", async ({ page, cplugin }) => {
    await cplugin.seedPlugin({
      label: "seed",
      title: "Seeded Plugin",
      source: sourceWithSeed("SEEDED", { title: "Seeded title" }),
    });

    await cplugin.gotoProject();
    await cplugin.addScene("Seeded Plugin");

    // Not blank: that was the bug. The operator sees the author's defaults.
    await expect(page.getByTestId("cplugin-title")).toHaveValue(
      "Seeded title",
      { timeout: 60_000 },
    );
  });
});
