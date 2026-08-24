// Starter template for a brand new plugin.
export const STARTER: Record<string, string> = {
  "doc.ts": `import {
  createLayoutDoc,
  createShapeElement,
  createTextElement,
  solidPaint,
} from "@repo/layout";
import type { DataBinding } from "@repo/layout";

// Tokens the plugin fills in at render time. Offered as insert chips in the
// layout editor, so they must match the {{ token }} names used below.
export const bindings: DataBinding[] = [
  { key: "title", label: "Title", type: "text" },
  { key: "subtitle", label: "Subtitle", type: "text" },
];

// Seeded by the manifest and reused by the remote's reset, so the defaults live
// in one place.
export const DEFAULT_TITLE = "Hello World";
export const DEFAULT_SUBTITLE = "Change me";

// Only the STARTING layout. Once seeded into pluginData the operator owns it and
// edits it from the UI, so nothing here is read again.
export const initialDoc = createLayoutDoc({
  elements: [
    createShapeElement({
      id: "background",
      name: "Background",
      kind: "rect",
      rect: { x: 0, y: 0, w: 100, h: 100 },
      fill: solidPaint("#0f172a"),
      locked: true,
    }),
    createTextElement({
      id: "title",
      name: "Title",
      rect: { x: 8, y: 30, w: 84, h: 26 },
      content: "{{ title }}",
      style: {
        fontSize: 9,
        fontWeight: 700,
        color: "#ffffff",
        align: "center",
      },
    }),
    createTextElement({
      id: "subtitle",
      name: "Subtitle",
      rect: { x: 8, y: 58, w: 84, h: 12 },
      content: "{{ subtitle }}",
      hideWhenEmpty: true,
      style: {
        fontSize: 3.6,
        fontWeight: 400,
        color: "#c7d2df",
      },
    }),
  ],
});
`,

  "remote.tsx": `import { usePluginAPI } from "@repo/base-plugin/client";
import { LayoutRenderer } from "@repo/layout/react";
import {
  Button,
  Input,
  OverlayToggle,
  PluginScaffold,
  PopConfirm,
} from "@repo/ui";
import { DEFAULT_SUBTITLE, DEFAULT_TITLE, initialDoc } from "./doc";
import StyleModal from "./StyleModal";

export default function Remote() {
  const pluginApi = usePluginAPI();

  // useData subscribes (re-renders on change); useValtioData writes.
  const title = pluginApi.scene.useData((x: any) => x.pluginData.title) ?? "";
  const subtitle =
    pluginApi.scene.useData((x: any) => x.pluginData.subtitle) ?? "";
  const doc = pluginApi.scene.useData((x: any) => x.pluginData.doc);
  const data = pluginApi.scene.useValtioData<any>();

  const currentScene = pluginApi.renderer.useCurrentScene();
  const isShowing = pluginApi.pluginContext.sceneId === currentScene;

  return (
    <PluginScaffold
      title="Starter"
      toolbar={
        <OverlayToggle
          toggler={({ onToggle }: any) => (
            <Button size="xs" variant="pill" onClick={onToggle}>
              Style
            </Button>
          )}
        >
          <StyleModal />
        </OverlayToggle>
      }
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
        // Preview top-left at a capped width, controls beside it.
        <div className="flex flex-col desktop:flex-row items-start gap-4 p-3 w-full">
          {/*
            aspect-video gives the 16:9 frame directly. Deliberately NOT <Slide>,
            which binds to the operator's zoom setting and is meaningless for a
            single fixed preview.
          */}
          <div className="w-full max-w-md shrink-0">
            <div className="w-full aspect-video overflow-hidden rounded border border-stroke bg-black">
              <LayoutRenderer
                doc={doc ?? initialDoc}
                data={{ title, subtitle }}
              />
            </div>
          </div>

          {/* Content controls only. Design lives in the Style modal. */}
          <div className="flex flex-col gap-2 flex-1 min-w-0">
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

            {/*
              A plain button writing shared state. No variant: pill is only for
              the scaffold's toolbar. Assigning to the valtio proxy syncs to
              every connected operator and the renderer.
            */}
            <div className="flex items-center gap-2 pt-2">
              <Button
                onClick={() => {
                  data.pluginData.subtitle = new Date().toLocaleDateString();
                }}
              >
                Use today's date
              </Button>

              {/* Destructive, so confirm first. */}
              <PopConfirm
                title="Reset the text?"
                description="Title and subtitle go back to their defaults. The layout is untouched."
                okText="Reset"
                onConfirm={() => {
                  data.pluginData.title = DEFAULT_TITLE;
                  data.pluginData.subtitle = DEFAULT_SUBTITLE;
                }}
              >
                <Button variant="outline">Reset text</Button>
              </PopConfirm>
            </div>
          </div>
        </div>
      }
    />
  );
}
`,

  "StyleModal.tsx": `import { usePluginAPI } from "@repo/base-plugin/client";
import { LayoutWorkbench } from "@repo/layout/editor";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  useOverlayToggle,
} from "@repo/ui";

import { bindings, initialDoc } from "./doc";

export default function StyleModal() {
  const pluginApi = usePluginAPI();
  // OverlayToggle passes open state through context, not props.
  const { isOpen, onToggle } = useOverlayToggle();

  const doc = pluginApi.scene.useData((x: any) => x.pluginData.doc);
  const title = pluginApi.scene.useData((x: any) => x.pluginData.title) ?? "";
  const subtitle =
    pluginApi.scene.useData((x: any) => x.pluginData.subtitle) ?? "";
  const data = pluginApi.scene.useValtioData<any>();

  return (
    <Dialog open={isOpen ?? false} onOpenChange={onToggle ?? (() => {})}>
      <DialogContent
        size="full"
        className="w-[96vw] max-w-[1400px] h-[88vh] flex flex-col p-0 gap-0"
      >
        <DialogHeader className="px-4 py-3 border-b border-stroke shrink-0">
          <DialogTitle>Slide design</DialogTitle>
        </DialogHeader>

        {/* The workbench needs a real height, so the body owns it. */}
        <DialogBody className="flex-1 min-h-0 p-0 overflow-hidden">
          <LayoutWorkbench
            doc={doc ?? initialDoc}
            onChange={(next: any) => (data.pluginData.doc = next)}
            data={{ title, subtitle }}
            bindings={bindings}
            aiThreadKey={\`starter:\${pluginApi.pluginContext.pluginId}\`}
            pluginApi={pluginApi}
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
`,

  "renderer.tsx": `import { usePluginAPI } from "@repo/base-plugin/client";
import { LayoutRenderer } from "@repo/layout/react";

import { initialDoc } from "./doc";

export default function Renderer() {
  const pluginApi = usePluginAPI();

  // The same doc the operator edits in the remote, so output matches the editor.
  const doc = pluginApi.scene.useData((x: any) => x.pluginData.doc);
  const title = pluginApi.scene.useData((x: any) => x.pluginData.title) ?? "";
  const subtitle =
    pluginApi.scene.useData((x: any) => x.pluginData.subtitle) ?? "";

  return (
    <LayoutRenderer doc={doc ?? initialDoc} data={{ title, subtitle }} />
  );
}
`,

  "manifest.ts": `import { DEFAULT_SUBTITLE, DEFAULT_TITLE, initialDoc } from "./doc";

export const manifest = {
  pluginData: {
    title: DEFAULT_TITLE,
    subtitle: DEFAULT_SUBTITLE,
    // Seeded once. From then on the operator owns the layout.
    doc: initialDoc,
  },
  rendererData: {},
};
`,
};
