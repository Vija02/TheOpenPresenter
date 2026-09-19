import type { RendererLayout } from "@repo/base-plugin";

import { createHostElement, createLayoutDoc } from "../schema/defaults";
import { createDerivation } from "../schema/derivation";
import { LayoutDoc } from "../schema/document";
import { HostSource, LayoutElement } from "../schema/element";
import { Rect } from "../schema/rect";

/**
 * Confidence monitors written before screen layouts moved to `@repo/layout`.
 *
 * The old shape was a flat list of scene/screen boxes with a percentage
 * position and an offset-only derivation, which maps one-to-one onto host
 * elements. Runs on read, so an existing project opens unchanged.
 *
 * The shapes below describe that stored format. They live here rather than in
 * @repo/base-plugin because this migration is the only thing left that reads
 * them, and they are never written again.
 */

type LegacyPosition = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type LegacyItemBase = {
  id: string;
  position: LegacyPosition;
  label?: string;
  /** Offset-only; the modern shape also carries plugin-specific params. */
  derivation: { offset: number } | null;
};

type LegacyItem = LegacyItemBase &
  (
    | { type: "sceneItem"; sourceRendererId: string; sceneId: string }
    | { type: "screenItem"; sourceRendererId: string }
  );

type LegacyRendererLayout = {
  enabled: boolean;
  aspectRatio: { width: number; height: number };
  items: LegacyItem[];
};

const isLegacy = (value: unknown): value is LegacyRendererLayout =>
  !!value &&
  typeof value === "object" &&
  Array.isArray((value as LegacyRendererLayout).items);

const toRect = (position: LegacyPosition): Rect => ({
  x: position?.x ?? 0,
  y: position?.y ?? 0,
  w: position?.width ?? 50,
  h: position?.height ?? 50,
});

const toSource = (item: LegacyItem): HostSource =>
  item.type === "screenItem"
    ? { kind: "screen", rendererId: item.sourceRendererId }
    : {
        kind: "scene",
        rendererId: item.sourceRendererId,
        sceneId: item.sceneId,
      };

/** The legacy shape */
const toDerivation = (item: LegacyItem) =>
  item.derivation
    ? createDerivation({ params: { offset: item.derivation.offset } })
    : null;

const toElement = (item: LegacyItem, index: number): LayoutElement =>
  createHostElement({
    // Item ids were typeids; keeping them means an in-flight edit still points
    // at the same box after the migration runs.
    id: item.id ?? `host-${index + 1}`,
    name: item.label ?? null,
    source: toSource(item),
    derivation: toDerivation(item),
    rect: toRect(item.position),
  });

export const migrateLegacyRendererLayout = (
  legacy: LegacyRendererLayout,
): LayoutDoc =>
  createLayoutDoc({
    aspectRatio: {
      width: legacy.aspectRatio?.width ?? 16,
      height: legacy.aspectRatio?.height ?? 9,
    },
    // Screen layouts are exact compositions on known hardware, so the design
    // aspect is preserved rather than stretched to the output.
    fitMode: "letterbox",
    elements: (legacy.items ?? []).map(toElement),
  });

/**
 * The layout document for a renderer, whichever shape it was stored in.
 * Null when the renderer has no layout at all.
 */
export const readRendererLayoutDoc = (
  layout: { enabled?: boolean; doc?: unknown } | null | undefined,
): LayoutDoc | null => {
  if (!layout) return null;
  if (isLegacy(layout)) return migrateLegacyRendererLayout(layout);
  return (layout.doc as LayoutDoc | undefined) ?? null;
};

/** A fresh, empty layout for a screen that has just switched one on. */
export const createRendererLayout = (): RendererLayout<LayoutDoc> => ({
  enabled: true,
  doc: createLayoutDoc({ fitMode: "letterbox" }),
});
