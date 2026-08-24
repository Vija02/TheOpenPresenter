import { expect, test } from "../../../fixtures/clientPluginFixture";
import { sourceWithMarker } from "./clientPluginSource";

/**
 * Install lifecycle, as the operator experiences it.
 *
 * The plugin is published over the API (the authoring UI is covered in
 * authoring.spec.ts), but every install change goes through the toggle on the
 * Plugins page and is confirmed where it matters: the scene picker in the
 * project. `enabled` lives on the install, so disabling must take the plugin out
 * of the picker without touching the built version.
 */

test.describe("client plugin installs", () => {
  test("disabling removes the plugin from the scene picker, enabling brings it back", async ({
    page,
    cplugin,
    pluginsAdmin,
    projectPage,
  }) => {
    await cplugin.seedPlugin({
      label: "toggle",
      title: "Toggle Plugin",
      source: sourceWithMarker("TOGGLE"),
    });

    // A published plugin is auto-installed for its owner org, so it is offered
    // straight away.
    await cplugin.gotoProject();
    await cplugin.addScene("Toggle Plugin");
    await expect(page.getByTestId("cplugin-marker")).toHaveText("TOGGLE", {
      timeout: 60_000,
    });

    await pluginsAdmin.goto(cplugin.orgSlug);
    await expect(
      pluginsAdmin.badge("Toggle Plugin", "latest 1.0.0"),
    ).toBeVisible();
    await pluginsAdmin.setEnabled("Toggle Plugin", false);

    // Gone from the picker, and no rebuild was involved.
    await cplugin.gotoProject();
    await cplugin.openScenePicker();
    await expect(projectPage.sceneCreatorOption("Toggle Plugin")).toHaveCount(
      0,
    );

    await pluginsAdmin.goto(cplugin.orgSlug);
    await pluginsAdmin.setEnabled("Toggle Plugin", true);

    await cplugin.gotoProject();
    await cplugin.addScene("Toggle Plugin");
    await expect(page.getByTestId("cplugin-marker")).toHaveText("TOGGLE", {
      timeout: 60_000,
    });
  });

  test("deleting a plugin removes it from the list and the picker", async ({
    page,
    cplugin,
    pluginsAdmin,
    projectPage,
  }) => {
    await cplugin.seedPlugin({
      label: "deleted",
      title: "Deleted Plugin",
      source: sourceWithMarker("DELETED"),
    });
    // A second plugin, to prove the delete is targeted.
    await cplugin.seedPlugin({
      label: "kept",
      title: "Kept Plugin",
      source: sourceWithMarker("KEPT"),
    });

    await pluginsAdmin.goto(cplugin.orgSlug);
    await pluginsAdmin.deletePlugin("Deleted Plugin");

    await expect(page.getByText("Deleted Plugin")).toHaveCount(0);
    await expect(
      pluginsAdmin.badge("Kept Plugin", "latest 1.0.0"),
    ).toBeVisible();

    await cplugin.gotoProject();
    await cplugin.openScenePicker();
    await expect(projectPage.sceneCreatorOption("Deleted Plugin")).toHaveCount(
      0,
    );
    await expect(
      projectPage.sceneCreatorOption("Kept Plugin").first(),
    ).toBeVisible();
  });

  test("disabling hides every version of the plugin at once", async ({
    cplugin,
    pluginsAdmin,
    projectPage,
  }) => {
    const { pluginId } = await cplugin.seedPlugin({
      label: "toggleversions",
      title: "Multi Version Plugin",
      version: "1.0.0",
      source: sourceWithMarker("TOGGLE-V1"),
    });
    const v2 = await cplugin.api.publish({
      clientPluginId: pluginId,
      version: "2.0.0",
      source: sourceWithMarker("TOGGLE-V2"),
    });

    await pluginsAdmin.goto(cplugin.orgSlug);
    await expect(
      pluginsAdmin.badge("Multi Version Plugin", "latest 2.0.0"),
    ).toBeVisible();

    await pluginsAdmin.setEnabled("Multi Version Plugin", false);

    // enabled lives on the install, not the version, so both versions go.
    const served = await cplugin.api.views();
    expect(
      served.filter((v) => v.pluginFamily === `cplugin-${pluginId}`),
    ).toHaveLength(0);
    expect(served.find((v) => v.versionId === v2)).toBeUndefined();

    await cplugin.gotoProject();
    await cplugin.openScenePicker();
    await expect(
      projectPage.sceneCreatorOption("Multi Version Plugin"),
    ).toHaveCount(0);
  });
});
