import type { ProjectLooks } from "@repo/base-types";

import {
  createHostElement,
  createLayoutDoc,
  createShapeElement,
} from "../schema/defaults";
import { createDerivation } from "../schema/derivation";
import { LayoutDoc } from "../schema/document";
import { HostSource } from "../schema/element";
import { solidPaint } from "../schema/paint";
import { Rect } from "../schema/rect";

export type LookTarget = {
  rendererId: string;
  sceneId: string;
  pluginId: string;
};

const bindSource = (source: HostSource, target: LookTarget): HostSource =>
  source.kind === "self" ? { kind: "plugin", ...target } : source;

/**
 * A plugin's look, pointing at one live plugin. Every `self` source, in
 * elements and feeds, becomes that plugin; everything else is left alone
 */
export const bindLookTarget = (
  doc: LayoutDoc,
  target: LookTarget,
): LayoutDoc => ({
  ...doc,
  elements: doc.elements.map((element) =>
    element.type === "host"
      ? { ...element, source: bindSource(element.source, target) }
      : element,
  ),
  feeds: doc.feeds
    ? doc.feeds.map((feed) => ({
        ...feed,
        source: bindSource(feed.source, target),
      }))
    : doc.feeds,
});

const BACKDROP_ID = "backdrop";

/** Behind everything, so a look covers what it is drawn over */
export const lookBackdrop = (color = "#000000") =>
  createShapeElement({
    id: BACKDROP_ID,
    name: "Backdrop",
    rect: { x: 0, y: 0, w: 100, h: 100 },
    fill: solidPaint(color),
    locked: true,
  });

export const selfHost = ({
  id,
  name,
  rect,
  params = null,
  opacity = 1,
}: {
  id: string;
  name: string;
  rect: Rect;
  params?: Record<string, unknown> | null;
  opacity?: number;
}) =>
  createHostElement({
    id,
    name,
    rect,
    opacity,
    source: { kind: "self" },
    derivation: params ? createDerivation({ params }) : null,
  });

/** Default confidence monitor */
export const defaultConfidenceLook = ({
  currentParams = {},
  nextParams = {},
  offsetParam = "offset",
}: {
  currentParams?: Record<string, unknown>;
  nextParams?: Record<string, unknown>;
  offsetParam?: string;
} = {}): LayoutDoc =>
  createLayoutDoc({
    fitMode: "letterbox",
    elements: [
      lookBackdrop(),
      selfHost({
        id: "live",
        name: "Live",
        rect: { x: 2, y: 3, w: 96, h: 58 },
        params: { [offsetParam]: 0, ...currentParams },
      }),
      createShapeElement({
        id: "divider",
        name: "Divider",
        rect: { x: 2, y: 63, w: 96, h: 0.4 },
        fill: solidPaint("#555555"),
      }),
      selfHost({
        id: "next",
        name: "Next",
        rect: { x: 2, y: 65, w: 96, h: 32 },
        params: { [offsetParam]: 1, ...nextParams },
      }),
    ],
  });

export type RegisteredPluginLooks = {
  pluginName: string;
  looks: unknown;
}[];

export const builtInPluginLook = (
  registered: RegisteredPluginLooks | null | undefined,
  pluginName: string,
  lookKey: string,
): LayoutDoc | null => {
  for (const entry of registered ?? []) {
    if (entry.pluginName !== pluginName) continue;
    const found = (entry.looks as { key: string; doc: LayoutDoc }[]).find(
      (look) => look.key === lookKey,
    );
    if (found) return found.doc;
  }
  return null;
};

/**
 * How a plugin shows in a look: the project's own version, else the
 * plugin's. Null shows the plugin as it always does
 */
export const resolvePluginLook = (
  registered: RegisteredPluginLooks | null | undefined,
  projectLooks: ProjectLooks | null | undefined,
  pluginName: string,
  lookKey: string,
): LayoutDoc | null =>
  (projectLooks?.[lookKey]?.plugins?.[pluginName] as LayoutDoc | undefined) ??
  builtInPluginLook(registered, pluginName, lookKey);
