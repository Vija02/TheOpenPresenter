import {
  BUILT_IN_LOOK_KEYS,
  DEFAULT_STYLE,
  type PluginLook,
  type ProjectLook,
  type ProjectLooks,
} from "@repo/base-types";

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

export type PluginStyle = PluginLook<LayoutDoc> & { style: string };

/** A plugin's styles for a look, its default first */
export const pluginStyles = (
  registered: RegisteredPluginLooks | null | undefined,
  pluginName: string,
  lookKey: string,
): PluginStyle[] =>
  (registered ?? [])
    .filter((entry) => entry.pluginName === pluginName)
    .flatMap((entry) => entry.looks as PluginLook<LayoutDoc>[])
    .filter((look) => look.key === lookKey)
    .map((look, index) => ({
      ...look,
      style: look.style ?? (index === 0 ? DEFAULT_STYLE : `style-${index}`),
    }));

/** The plugin's default style for a look */
export const builtInPluginLook = (
  registered: RegisteredPluginLooks | null | undefined,
  pluginName: string,
  lookKey: string,
): LayoutDoc | null =>
  pluginStyles(registered, pluginName, lookKey)[0]?.doc ?? null;

/** Bounds a chain of `base` looks, in case one points back at itself */
const MAX_LOOK_DEPTH = 8;

export type PluginLookChoice =
  /** Changed for this look */
  | { kind: "own" }
  /** One of the plugin's styles, picked here or on a look it starts from */
  | { kind: "style"; style: PluginStyle }
  /** The plugin as it always shows */
  | { kind: "plain" };

/**
 * How a plugin shows in a look: changed for it, else the style it picks,
 * else as its base look shows it, else the plugin's default style
 */
export const pluginLookChoice = (
  registered: RegisteredPluginLooks | null | undefined,
  projectLooks: ProjectLooks | null | undefined,
  pluginName: string,
  lookKey: string,
): PluginLookChoice => {
  const styles = pluginStyles(
    registered,
    pluginName,
    rootLookKey(projectLooks, lookKey),
  );
  let key: string | null | undefined = lookKey;
  for (let depth = 0; key && depth < MAX_LOOK_DEPTH; depth++) {
    const look: ProjectLook | undefined = projectLooks?.[key];
    if (look?.plugins?.[pluginName]) return { kind: "own" };
    const picked = look?.styles?.[pluginName];
    const byName = picked && styles.find((entry) => entry.style === picked);
    if (byName) return { kind: "style", style: byName };
    if (!look?.base) break;
    key = look.base;
  }
  return styles[0] ? { kind: "style", style: styles[0] } : { kind: "plain" };
};

/**
 * The layout a plugin shows in a look, as `pluginLookChoice` picks it. Null
 * shows the plugin as it always does
 */
export const resolvePluginLook = (
  registered: RegisteredPluginLooks | null | undefined,
  projectLooks: ProjectLooks | null | undefined,
  pluginName: string,
  lookKey: string,
): LayoutDoc | null => {
  const choice = pluginLookChoice(
    registered,
    projectLooks,
    pluginName,
    lookKey,
  );
  if (choice.kind === "style") return choice.style.doc;
  if (choice.kind === "plain") return null;
  // The first look on the way that changed it
  let key: string | null | undefined = lookKey;
  for (let depth = 0; key && depth < MAX_LOOK_DEPTH; depth++) {
    const own = projectLooks?.[key]?.plugins?.[pluginName];
    if (own) return own as LayoutDoc;
    key = projectLooks?.[key]?.base;
  }
  return null;
};

/** The built-in look a project's own look starts from, eg. confidence */
export const rootLookKey = (
  projectLooks: ProjectLooks | null | undefined,
  lookKey: string,
): string => {
  let key = lookKey;
  for (let depth = 0; depth < MAX_LOOK_DEPTH; depth++) {
    const base = projectLooks?.[key]?.base;
    if (!base) return key;
    key = base;
  }
  return key;
};

/** A key for a project's own look that no other look uses */
export const newProjectLookKey = (
  projectLooks: ProjectLooks | null | undefined,
  base: string,
): string => {
  let n = 2;
  while (projectLooks?.[`${base}-${n}`]) n += 1;
  return `${base}-${n}`;
};

export type LookSummary = {
  key: string;
  name: string;
  /** The built-in look it starts from, eg. confidence */
  type: string;
  builtIn: boolean;
  /** Turned off: not offered when picking a screen's look */
  hidden: boolean;
};

/** Every look in a project: by type, each built-in one before its copies */
export const listLooks = (
  projectLooks: ProjectLooks | null | undefined,
): LookSummary[] => {
  const builtInKeys = BUILT_IN_LOOK_KEYS.map((look) => look.key);
  const builtIns = BUILT_IN_LOOK_KEYS.map(
    ({ key, name }): LookSummary => ({
      key,
      name,
      type: key,
      builtIn: true,
      hidden: !!projectLooks?.[key]?.hidden,
    }),
  );
  const own = Object.entries(projectLooks ?? {})
    .filter(([key, look]) => !builtInKeys.includes(key) && !!look?.base)
    .map(
      ([key, look]): LookSummary => ({
        key,
        name: look.name || key,
        type: rootLookKey(projectLooks, key),
        builtIn: false,
        hidden: !!look.hidden,
      }),
    );
  const order = (type: string) => {
    const index = builtInKeys.indexOf(type);
    return index === -1 ? builtInKeys.length : index;
  };
  // Stable: the built-in one first, then its copies as they were made
  return [...builtIns, ...own].sort((a, b) => order(a.type) - order(b.type));
};
