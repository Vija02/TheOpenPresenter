// @vitest-environment node
import { describe, expect, it } from "vitest";

import { buildClientPlugin } from "../build";
import { clientPluginVersionName } from "../naming";

const PLUGIN_ID = "f5ca7764-a5be-45fe-b8d8-8b773c239a2a";
const VERSION_ID = "e58a477c-5598-40bb-a369-807c8eddd088";

const source = {
  "remote.tsx": `
    export default () => (
      <div className="flex flex-col desktop:flex-row gap-4">
        <div className="w-full max-w-md aspect-video" />
      </div>
    );
  `,
  "renderer.tsx": `export default () => <div className="p-3" />;`,
  "manifest.ts": `export const manifest = { pluginData: {}, rendererData: {} };`,
};

describe("scoped CSS matches the container the apps render", () => {
  it("prefixes responsive variants with the versioned container id", async () => {
    const result = await buildClientPlugin(PLUGIN_ID, VERSION_ID, source);
    if (!result.ok) throw new Error(result.log);

    const css =
      result.files.find((f) => f.filename === "remote.css")?.content ?? "";

    // This is exactly the id rendered as `pl-${resolvedPluginName}`.
    const containerId = `pl-${clientPluginVersionName(PLUGIN_ID, VERSION_ID)}`;

    expect(css).toContain(`#${containerId} .desktop\\:flex-row`);
    expect(css).toContain("48rem");
    // Every scoped rule must carry that id; a version-free scope selects nothing.
    expect(css).not.toContain(`#pl-cplugin-${PLUGIN_ID} .`);
  }, 60_000);
});
