// @vitest-environment node
import { describe, expect, it } from "vitest";

import { buildClientPlugin } from "../build";
import { remoteTag, rendererTag, runtimePluginName } from "../naming";

const PLUGIN_A = "aaaaaaaa-0000-0000-0000-000000000000";
const PLUGIN_B = "bbbbbbbb-0000-0000-0000-000000000000";
const V1 = "11111111-0000-0000-0000-000000000000";
const V2 = "22222222-0000-0000-0000-000000000000";

const src = (label: string) => ({
  "remote.tsx": `export default () => <div className="p-3">${label}</div>;`,
  "renderer.tsx": `export default () => <div className="p-3">${label}</div>;`,
  "manifest.ts": `export const manifest = { pluginData: {}, rendererData: {} };`,
});

const definedTags = (js: string) =>
  [...js.matchAll(/customElements\.define\("([^"]+)"/g)].map((m) => m[1]);

describe("tag identity across plugins and versions", () => {
  it("gives two versions of one plugin different tags", async () => {
    const a1 = await buildClientPlugin(PLUGIN_A, V1, src("a1"));
    const a2 = await buildClientPlugin(PLUGIN_A, V2, src("a2"));
    if (!a1.ok || !a2.ok) throw new Error("build failed");

    const t1 = definedTags(
      a1.files.find((f) => f.filename.endsWith("remote.es.js"))!.content,
    );
    const t2 = definedTags(
      a2.files.find((f) => f.filename.endsWith("remote.es.js"))!.content,
    );

    expect(t1).toHaveLength(1);
    expect(t1).not.toEqual(t2);
  }, 60_000);

  it("gives two different plugins different tags and names", async () => {
    expect(runtimePluginName(PLUGIN_A)).not.toBe(runtimePluginName(PLUGIN_B));
    expect(remoteTag(PLUGIN_A, V1)).not.toBe(remoteTag(PLUGIN_B, V1));
    expect(rendererTag(PLUGIN_A, V1)).not.toBe(rendererTag(PLUGIN_B, V1));
  });
});
