import { expect, test } from "../../../fixtures/clientPluginFixture";

/**
 * Authoring a plugin from scratch, through the UI an author really uses.
 *
 * Nothing here is bootstrapped: the plugin is created in the details modal, its
 * source is edited in Monaco, built by the real esbuild + Tailwind pipeline, and
 * published through the version modal. The publish gate (a passing test build)
 * only exists in this UI, so it can only be covered from here.
 */

const MARKER_REMOTE = `import { usePluginAPI } from "@repo/base-plugin/client";
import { PluginScaffold } from "@repo/ui";

export default function Remote() {
  const pluginApi = usePluginAPI();
  const title = pluginApi.scene.useData((x: any) => x.pluginData.title) ?? "";

  return (
    <PluginScaffold
      title="Authored"
      body={
        <div className="p-3">
          <p data-testid="authored-marker">AUTHORED-IN-UI</p>
          <p data-testid="authored-title">{title}</p>
        </div>
      }
    />
  );
}
`;

test.describe("client plugin authoring", () => {
  // The build pipeline compiles real source, and publishing runs it twice.

  test("creates, builds and publishes a plugin, then adds a scene from it", async ({
    page,
    cplugin,
    pluginsAdmin,
  }) => {
    await pluginsAdmin.goto(cplugin.orgSlug);

    // A brand new org starts empty, so the author sees the prompt.
    await expect(page.getByText("No plugins yet")).toBeVisible();

    await pluginsAdmin.createPlugin("Authored Plugin", "Made by the e2e suite");

    // The editor opens on the starter template, which is what the author edits.
    await expect(pluginsAdmin.fileTab("remote.tsx")).toBeVisible();
    await expect(pluginsAdmin.fileTab("renderer.tsx")).toBeVisible();
    await expect(pluginsAdmin.fileTab("manifest.ts")).toBeVisible();
    await expect(page.getByText("Not tested yet")).toBeVisible();

    // Publishing is gated behind a passing test build.
    await expect(pluginsAdmin.publishButton).toBeDisabled();

    await pluginsAdmin.writeFile("remote.tsx", MARKER_REMOTE);
    await pluginsAdmin.runTestBuild();
    await pluginsAdmin.expectBuildPassed();
    await expect(pluginsAdmin.publishButton).toBeEnabled();

    await pluginsAdmin.publish("Authored Plugin", "0.0.1", { bump: "patch" });

    // The row now describes a published, installed, enabled plugin.
    await expect(
      pluginsAdmin.badge("Authored Plugin", "latest 0.0.1"),
    ).toBeVisible();
    await expect(
      pluginsAdmin.badge("Authored Plugin", "Enabled"),
    ).toBeVisible();

    // The whole point of publishing: it becomes a scene the operator can add.
    await cplugin.gotoProject();
    await cplugin.addScene("Authored Plugin");

    // Loading a freshly published remote bundle takes a moment.
    await expect(page.getByTestId("authored-marker")).toHaveText(
      "AUTHORED-IN-UI",
      { timeout: 60_000 },
    );
  });

  test("shows the build log and refuses to publish broken source", async ({
    page,
    cplugin,
    pluginsAdmin,
  }) => {
    await pluginsAdmin.goto(cplugin.orgSlug);
    await pluginsAdmin.createPlugin("Broken Plugin");

    await pluginsAdmin.writeFile(
      "remote.tsx",
      // Node builtins are not importable by a plugin.
      `import fs from "fs";\nexport default () => fs.readFileSync("x");\n`,
    );
    await pluginsAdmin.runTestBuild();

    await pluginsAdmin.expectBuildFailed();
    // The author needs the reason, not just a failure.
    await expect(pluginsAdmin.buildLog).toContainText("fs");
    await expect(pluginsAdmin.publishButton).toBeDisabled();

    // Fixing the source clears the gate without reloading anything.
    await pluginsAdmin.writeFile("remote.tsx", MARKER_REMOTE);
    await pluginsAdmin.runTestBuild();
    await pluginsAdmin.expectBuildPassed();
    await expect(pluginsAdmin.publishButton).toBeEnabled();

    await pluginsAdmin.closeEditorButton.click();
    // Never published, so no install row exists to toggle.
    await expect(
      pluginsAdmin.badge("Broken Plugin", "Not published"),
    ).toBeVisible();
    await expect(pluginsAdmin.badge("Broken Plugin", "draft")).toBeVisible();
    await expect(pluginsAdmin.enabledSwitch("Broken Plugin")).toHaveCount(0);
  });

  test("re-requires a test build after the source changes", async ({
    page,
    cplugin,
    pluginsAdmin,
  }) => {
    await pluginsAdmin.goto(cplugin.orgSlug);
    await pluginsAdmin.createPlugin("Stale Build Plugin");

    await pluginsAdmin.writeFile("remote.tsx", MARKER_REMOTE);
    await pluginsAdmin.runTestBuild();
    await pluginsAdmin.expectBuildPassed();

    // Editing after a pass must invalidate it, or an author could publish
    // source that was never compiled.
    await pluginsAdmin.replaceActiveFile(
      MARKER_REMOTE.replace("AUTHORED-IN-UI", "EDITED-SINCE-BUILD"),
    );
    await expect(
      page.getByText("Edited since last build, re-test"),
    ).toBeVisible();
    await expect(pluginsAdmin.publishButton).toBeDisabled();
  });

  test("adds and deletes an extra file, and keeps required files", async ({
    cplugin,
    pluginsAdmin,
  }) => {
    await pluginsAdmin.goto(cplugin.orgSlug);
    await pluginsAdmin.createPlugin("File Plugin");

    await pluginsAdmin.addFile("helper.tsx");
    await pluginsAdmin.replaceActiveFile(
      `export const MARK = "FROM-HELPER";\n`,
    );

    // The new file is really part of the compile unit.
    await pluginsAdmin.writeFile(
      "remote.tsx",
      MARKER_REMOTE.replace(
        `import { PluginScaffold } from "@repo/ui";`,
        `import { PluginScaffold } from "@repo/ui";\nimport { MARK } from "./helper";`,
      ).replace("AUTHORED-IN-UI", "{MARK}"),
    );
    await pluginsAdmin.runTestBuild();
    await pluginsAdmin.expectBuildPassed();

    // Required files cannot be removed, so they offer no delete affordance.
    await expect(
      pluginsAdmin.page.getByRole("button", { name: "Delete remote.tsx" }),
    ).toHaveCount(0);

    await pluginsAdmin.deleteFile("helper.tsx");
    // Deleting a file its importer needs must break the build, not pass quietly.
    await pluginsAdmin.runTestBuild();
    await pluginsAdmin.expectBuildFailed();
  });
});
