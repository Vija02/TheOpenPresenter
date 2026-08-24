import { expect, test } from "../../../fixtures/clientPluginFixture";
import { sourceWithMarker } from "./clientPluginSource";

/**
 * Versioning, from the operator's side.
 *
 * A scene records a VERSIONED plugin name when it is created, so publishing a
 * newer version must not move an existing scene onto it. That regression
 * produced "No renderer for cplugin-<id>-<versionId>", and the only way to see
 * it is to create a scene, publish over it, and reload the project.
 */

test.describe("client plugin versions", () => {
  test("an existing scene keeps its version after a newer one is published", async ({
    page,
    cplugin,
  }) => {
    const { pluginId } = await cplugin.seedPlugin({
      label: "pin",
      title: "Pinned Plugin",
      version: "1.0.0",
      source: sourceWithMarker("VERSION-ONE"),
    });

    await cplugin.gotoProject();
    await cplugin.addScene("Pinned Plugin");
    await expect(page.getByTestId("cplugin-marker")).toHaveText("VERSION-ONE", {
      timeout: 60_000,
    });

    // Publish a newer version behind the operator's back.
    await cplugin.api.publish({
      clientPluginId: pluginId,
      version: "2.0.0",
      source: sourceWithMarker("VERSION-TWO"),
    });

    // The existing scene must still load v1: it persisted v1's plugin name.
    await page.reload();
    await expect(page.getByTestId("cplugin-marker")).toHaveText("VERSION-ONE", {
      timeout: 60_000,
    });

    // A NEW scene takes the newest version, since that is the install default.
    await cplugin.addScene("Pinned Plugin");
    await expect(page.getByTestId("cplugin-marker")).toHaveText("VERSION-TWO", {
      timeout: 60_000,
    });
  });

  test("a version pin decides what a new scene is created with", async ({
    page,
    cplugin,
    pluginsAdmin,
  }) => {
    const { pluginId, versionId: v1 } = await cplugin.seedPlugin({
      label: "orgpin",
      title: "Org Pinned Plugin",
      version: "1.0.0",
      source: sourceWithMarker("PINNED-OLD"),
    });
    const v2 = await cplugin.api.publish({
      clientPluginId: pluginId,
      version: "2.0.0",
      source: sourceWithMarker("NEWER"),
    });

    // Newest wins by default.
    await pluginsAdmin.goto(cplugin.orgSlug);
    await expect(
      pluginsAdmin.badge("Org Pinned Plugin", "latest 2.0.0"),
    ).toBeVisible();

    // Pin the org back to the older version.
    await cplugin.api.updateInstall({
      organizationId: cplugin.organizationId,
      clientPluginId: pluginId,
      patch: { pinnedVersionId: v1 },
    });

    await pluginsAdmin.goto(cplugin.orgSlug);
    // The badge tells the operator a pin is in force, not just what is newest.
    await expect(
      pluginsAdmin.badge("Org Pinned Plugin", "pinned 1.0.0"),
    ).toBeVisible();

    // The pin beats recency, so a new scene gets v1.
    await cplugin.gotoProject();
    await cplugin.addScene("Org Pinned Plugin");
    await expect(page.getByTestId("cplugin-marker")).toHaveText("PINNED-OLD", {
      timeout: 60_000,
    });

    // Moving the pin forward moves what new scenes get, and leaves the
    // already-created scene alone.
    await cplugin.api.updateInstall({
      organizationId: cplugin.organizationId,
      clientPluginId: pluginId,
      patch: { pinnedVersionId: v2 },
    });

    await cplugin.gotoProject();
    await cplugin.addScene("Org Pinned Plugin");
    await expect(page.getByTestId("cplugin-marker")).toHaveText("NEWER", {
      timeout: 60_000,
    });
  });

  test("refuses to publish a version number that already exists", async ({
    cplugin,
    pluginsAdmin,
  }) => {
    await cplugin.seedPlugin({
      label: "immutable",
      title: "Immutable Plugin",
      version: "1.0.0",
      source: sourceWithMarker("TAKEN"),
    });

    await pluginsAdmin.goto(cplugin.orgSlug);
    // Pinned to the published source's marker: the editor shows the starter
    // until the fetch lands, and building before that invalidates itself.
    await pluginsAdmin.openEditor("Immutable Plugin", "TAKEN");

    // The editor lists what already exists, which is what makes 1.0.0 taken.
    await expect(pluginsAdmin.versionEntry("1.0.0")).toBeVisible();

    await pluginsAdmin.runTestBuild();
    await pluginsAdmin.expectBuildPassed();

    await pluginsAdmin.publishButton.click();
    await pluginsAdmin.customVersionInput.fill("1.0.0");

    // Versions are immutable, so republishing over one must be blocked here.
    await expect(pluginsAdmin.versionTakenWarning).toBeVisible();
    await expect(pluginsAdmin.confirmPublishButton("1.0.0")).toBeDisabled();
  });
});
