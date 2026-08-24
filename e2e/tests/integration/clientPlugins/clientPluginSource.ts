import { STARTER } from "../../../../apps/project/src/containers/Plugins/starterTemplate";

/**
 * Plugin source for the cplugin specs.
 *
 * Built on the real starter template rather than a hand-written copy, so these
 * tests break if the template stops compiling: that is the source every new
 * plugin begins as, and it is worth knowing when it rots.
 */
const STARTER_SOURCE: Record<string, string> = STARTER;

/**
 * The starter with markers rendered into BOTH views, so a spec can tell which
 * VERSION of a plugin actually loaded on each surface. Also stamps unique
 * Tailwind classes, which is what proves Tailwind compiled this version's
 * classes and not another's.
 */
export const sourceWithMarker = (marker: string): Record<string, string> => ({
  ...STARTER_SOURCE,
  "remote.tsx": `import { usePluginAPI } from "@repo/base-plugin/client";
import { Button, Input, PluginScaffold } from "@repo/ui";

export default function Remote() {
  const pluginApi = usePluginAPI();
  const title = pluginApi.scene.useData((x: any) => x.pluginData.title) ?? "";
  const data = pluginApi.scene.useValtioData<any>();

  const currentScene = pluginApi.renderer.useCurrentScene();
  const isShowing = pluginApi.pluginContext.sceneId === currentScene;

  return (
    <PluginScaffold
      title="Marker"
      postToolbar={
        <Button
          size="xs"
          variant="pill"
          onClick={() => pluginApi.renderer.setRenderCurrentScene()}
        >
          {isShowing ? "Showing" : "Go live"}
        </Button>
      }
      body={
        <div className="flex flex-col desktop:flex-row gap-4 p-3 tracking-wide">
          <p data-testid="cplugin-marker">${marker}</p>
          <Input
            data-testid="cplugin-title"
            value={title}
            onChange={(e: any) => (data.pluginData.title = e.target.value)}
          />
        </div>
      }
    />
  );
}
`,
  "renderer.tsx": `import { usePluginAPI } from "@repo/base-plugin/client";

export default function Renderer() {
  const pluginApi = usePluginAPI();
  const title = pluginApi.scene.useData((x: any) => x.pluginData.title) ?? "";

  return (
    <div className="p-3">
      <p data-testid="cplugin-renderer-marker">${marker}</p>
      <p data-testid="cplugin-renderer-title">{title}</p>
    </div>
  );
}
`,
});

/** A marker source whose manifest seeds an explicit title. */
export const sourceWithSeed = (
  marker: string,
  seed: { title: string; subtitle?: string },
): Record<string, string> => ({
  ...sourceWithMarker(marker),
  "manifest.ts": `export const manifest = {
  pluginData: ${JSON.stringify({ title: seed.title, subtitle: seed.subtitle ?? "" })},
  rendererData: {},
};
`,
});
