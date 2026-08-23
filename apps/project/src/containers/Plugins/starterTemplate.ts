// Starter template for a brand new plugin.
export const STARTER: Record<string, string> = {
  "doc.ts": `import {
  createLayoutDoc,
  createShapeElement,
  createTextElement,
  solidPaint,
} from "@repo/layout";

export const buildDoc = ({
  background,
  color,
}: {
  background: string;
  color: string;
}) =>
  createLayoutDoc({
    elements: [
      createShapeElement({
        id: "background",
        name: "Background",
        kind: "rect",
        rect: { x: 0, y: 0, w: 100, h: 100 },
        fill: solidPaint(background),
        locked: true,
      }),
      createTextElement({
        id: "title",
        name: "Title",
        rect: { x: 8, y: 30, w: 84, h: 26 },
        content: "{{ title }}",
        style: { fontSize: 9, fontWeight: 700, color, align: "center" },
      }),
      createTextElement({
        id: "subtitle",
        name: "Subtitle",
        rect: { x: 8, y: 58, w: 84, h: 12 },
        content: "{{ subtitle }}",
        hideWhenEmpty: true,
        style: { fontSize: 3.6, fontWeight: 400, color, opacity: 0.75 },
      }),
    ],
  });
`,

  "remote.tsx": `import { usePluginAPI } from "@repo/base-plugin/client";
import { LayoutRenderer } from "@repo/layout/react";
import { Button, Input } from "@repo/ui";
import { useMemo } from "react";

import { buildDoc } from "./doc";

export default function Remote() {
  const pluginApi = usePluginAPI();

  const title = pluginApi.scene.useData((x: any) => x.pluginData.title) ?? "";
  const subtitle =
    pluginApi.scene.useData((x: any) => x.pluginData.subtitle) ?? "";
  const background =
    pluginApi.scene.useData((x: any) => x.pluginData.background) ?? "#0f172a";
  const color =
    pluginApi.scene.useData((x: any) => x.pluginData.color) ?? "#ffffff";
  const data = pluginApi.scene.useValtioData<any>();

  const doc = useMemo(
    () => buildDoc({ background, color }),
    [background, color],
  );

  return (
    <div className="flex flex-col gap-3 p-4">
      <label className="text-sm font-medium">Title</label>
      <Input
        value={title}
        onChange={(e: any) => (data.pluginData.title = e.target.value)}
      />

      <label className="text-sm font-medium">Subtitle</label>
      <Input
        value={subtitle}
        onChange={(e: any) => (data.pluginData.subtitle = e.target.value)}
      />

      <div className="flex gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Background</label>
          <input
            type="color"
            value={background}
            onChange={(e) => (data.pluginData.background = e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Text</label>
          <input
            type="color"
            value={color}
            onChange={(e) => (data.pluginData.color = e.target.value)}
          />
        </div>
      </div>

      <div className="w-full max-w-md border rounded overflow-hidden">
        <LayoutRenderer doc={doc} data={{ title, subtitle }} />
      </div>

      <div>
        {/* Sends this scene to the live output. */}
        <Button
          variant="success"
          onClick={() => pluginApi.renderer.setRenderCurrentScene()}
        >
          Go live
        </Button>
      </div>
    </div>
  );
}
`,

  "renderer.tsx": `import { usePluginAPI } from "@repo/base-plugin/client";
import { LayoutRenderer } from "@repo/layout/react";
import { useMemo } from "react";

import { buildDoc } from "./doc";

export default function Renderer() {
  const pluginApi = usePluginAPI();

  const title = pluginApi.scene.useData((x: any) => x.pluginData.title) ?? "";
  const subtitle =
    pluginApi.scene.useData((x: any) => x.pluginData.subtitle) ?? "";
  const background =
    pluginApi.scene.useData((x: any) => x.pluginData.background) ?? "#0f172a";
  const color =
    pluginApi.scene.useData((x: any) => x.pluginData.color) ?? "#ffffff";

  const doc = useMemo(
    () => buildDoc({ background, color }),
    [background, color],
  );

  return <LayoutRenderer doc={doc} data={{ title, subtitle }} />;
}
`,

  "manifest.ts": `export const manifest = {
  pluginData: {
    title: "Hello",
    subtitle: "Edit me in the remote",
    background: "#0f172a",
    color: "#ffffff",
  },
  rendererData: {},
};
`,
};
