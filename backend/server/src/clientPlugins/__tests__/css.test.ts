// @vitest-environment node
// esbuild refuses to run under jsdom: its TextEncoder returns a foreign
// Uint8Array, which trips esbuild's startup invariant.
import { describe, expect, it } from "vitest";

import { buildClientPlugin } from "../build";

const REMOTE = `
export default function Remote() {
  return (
    <div className="stack-row items-start flex-wrap gap-4 desktop:flex-row hover:bg-fill-muted">
      <div className="w-full max-w-md aspect-video text-secondary" />
    </div>
  );
}
`;

const RENDERER = `export default function Renderer() { return <div className="p-3" />; }`;
const MANIFEST = `export const manifest = { pluginData: {}, rendererData: {} };`;

const source = {
  "remote.tsx": REMOTE,
  "renderer.tsx": RENDERER,
  "manifest.ts": MANIFEST,
};

const CLIENT_PLUGIN_ID = "abc";
const VERSION_ID = "def";

const build = async () => {
  const result = await buildClientPlugin(CLIENT_PLUGIN_ID, VERSION_ID, source);
  if (!result.ok) throw new Error(result.log);
  return result;
};

describe("client plugin CSS", () => {
  it("compiles Tailwind for the classes the author used", async () => {
    const { files } = await build();
    const css = files.find((f) => f.filename === "remote.css")?.content ?? "";

    // Custom @utility from the project config.
    expect(css).toContain("stack-row");
    // Plain utilities the host app may never have emitted.
    expect(css).toContain("max-w-md");
    expect(css).toContain("aspect-video");
    // The responsive variant that used to silently produce nothing.
    expect(css).toContain("desktop\\:flex-row");
    expect(css).toContain("48rem");
  }, 30_000);

  it("scopes every top-level selector to the plugin container", async () => {
    const { files } = await build();
    const css = files.find((f) => f.filename === "remote.css")?.content ?? "";

    // Must match the `pl-${resolvedPluginName}` container id the apps render,
    // and that name is the VERSIONED one.
    expect(css).toContain(`#pl-cplugin-${CLIENT_PLUGIN_ID}-${VERSION_ID}`);
    expect(css).toContain(
      `#pl-cplugin-${CLIENT_PLUGIN_ID}-${VERSION_ID} .stack-row`,
    );
    // :root would leak theme variables onto the host document.
    expect(css).not.toMatch(/(^|[\s,{])(:root|:host)\b/m);
  }, 30_000);

  it("does not prefix nested selectors, which would match nothing", async () => {
    const { files } = await build();
    const css = files.find((f) => f.filename === "remote.css")?.content ?? "";

    const scoped = css.match(/#pl-cplugin-abc/g)?.length ?? 0;
    expect(scoped).toBeGreaterThan(0);
    // A nested rule already sits inside a scoped parent, so a second prefix
    // inside the same block is a bug.
    expect(css).not.toMatch(/#pl-cplugin-abc[^{}]*\{[^{}]*#pl-cplugin-abc/);
  }, 30_000);
});
