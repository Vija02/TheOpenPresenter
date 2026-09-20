/**
 * Pure, immutable edits to a LayoutDoc.
 */
import { clampRect, roundRect } from "../geometry/rect";
import {
  Derivation,
  createDerivation,
  isIdentityDerivation,
} from "../schema/derivation";
import { LayoutDoc } from "../schema/document";
import {
  HostElement,
  HostSource,
  LayoutElement,
  TextElement,
} from "../schema/element";
import { FillPaint, VideoPaint, VideoPlaybackMode } from "../schema/paint";
import { Rect } from "../schema/rect";
import { TextStylePatch } from "../schema/style";
import { LayoutFeed, freshFeedName, sanitiseFeedName } from "../schema/feed";

/**
 * Deep clone AND strip `undefined`.
 *
 * Both halves matter when the result is persisted through valtio-yjs, which
 * cannot represent `undefined`; and cloning stops an edit from mutating a
 * module-level template object for the rest of the session.
 */
export const cloneDoc = (doc: LayoutDoc): LayoutDoc =>
  JSON.parse(JSON.stringify(doc)) as LayoutDoc;

export const findElement = (doc: LayoutDoc, id: string): LayoutElement | null =>
  doc.elements.find((e) => e.id === id) ?? null;

export const mapElement = (
  doc: LayoutDoc,
  id: string,
  fn: (element: LayoutElement) => LayoutElement,
): LayoutDoc => ({
  ...doc,
  elements: doc.elements.map((e) => (e.id === id ? fn(e) : e)),
});

/** Patch fields common to every element kind (rect, hidden, opacity, ...). */
export const patchElement = (
  doc: LayoutDoc,
  id: string,
  patch: Partial<LayoutElement>,
): LayoutDoc =>
  mapElement(doc, id, (e) => ({ ...e, ...patch }) as LayoutElement);

export const patchRect = (
  doc: LayoutDoc,
  id: string,
  patch: Partial<Rect>,
): LayoutDoc =>
  mapElement(doc, id, (e) => ({ ...e, rect: { ...e.rect, ...patch } }));

/** No-op on non-text elements, so callers need not narrow first. */
export const patchTextStyle = (
  doc: LayoutDoc,
  id: string,
  patch: TextStylePatch,
): LayoutDoc =>
  mapElement(doc, id, (e) =>
    e.type === "text" ? { ...e, style: { ...e.style, ...patch } } : e,
  );

export const patchTextElement = (
  doc: LayoutDoc,
  id: string,
  patch: Partial<Omit<TextElement, "type" | "style">>,
): LayoutDoc =>
  mapElement(doc, id, (e) => (e.type === "text" ? { ...e, ...patch } : e));

/** No-op on non-host elements, so callers need not narrow first. */
export const patchHostElement = (
  doc: LayoutDoc,
  id: string,
  patch: Partial<Omit<HostElement, "type">>,
): LayoutDoc =>
  mapElement(doc, id, (e) => (e.type === "host" ? { ...e, ...patch } : e));

/** `null` puts the element back on the live data. */
export const setHostDerivation = (
  doc: LayoutDoc,
  id: string,
  derivation: Derivation | null,
): LayoutDoc => patchHostElement(doc, id, { derivation });

/** Merges into a host element's derivation params */
export const patchHostDerivationParams = (
  doc: LayoutDoc,
  id: string,
  params: Record<string, unknown>,
): LayoutDoc =>
  mapElement(doc, id, (e) => {
    if (e.type !== "host") return e;

    const base = e.derivation ?? createDerivation();
    const merged: Record<string, unknown> = { ...(base.params ?? {}) };
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) delete merged[key];
      else merged[key] = value;
    }

    const next = {
      ...base,
      params: Object.keys(merged).length > 0 ? merged : null,
    };

    return {
      ...e,
      derivation: isIdentityDerivation(next) ? null : next,
    };
  });

/** Repoints a host element at different live content. */
export const setHostSource = (
  doc: LayoutDoc,
  id: string,
  source: HostSource,
): LayoutDoc => patchHostElement(doc, id, { source });

export const hostElements = (doc: LayoutDoc): HostElement[] =>
  doc.elements.filter((e): e is HostElement => e.type === "host");

// ---------------------------------------------------------------------------
// Feeds. Named sources that text tokens read, as `{{<feed>.<key>}}`.
// ---------------------------------------------------------------------------

/** Documents predating feeds store none. */
export const docFeeds = (doc: LayoutDoc): LayoutFeed[] => doc.feeds ?? [];

export const addFeed = (
  doc: LayoutDoc,
  feed: Omit<LayoutFeed, "name"> & { name?: string },
): { doc: LayoutDoc; name: string } => {
  const feeds = docFeeds(doc);
  const name = freshFeedName(feeds, feed.name ?? "feed");
  return {
    doc: { ...doc, feeds: [...feeds, { ...feed, name }] },
    name,
  };
};

export const removeFeed = (doc: LayoutDoc, name: string): LayoutDoc => ({
  ...doc,
  feeds: docFeeds(doc).filter((feed) => feed.name !== name),
});

export const patchFeed = (
  doc: LayoutDoc,
  name: string,
  patch: Partial<Omit<LayoutFeed, "name">>,
): LayoutDoc => ({
  ...doc,
  feeds: docFeeds(doc).map((feed) =>
    feed.name === name ? { ...feed, ...patch } : feed,
  ),
});

/**
 * Renames a feed and rewrites every token that addressed it, so the text
 * elements do not silently go blank. Returns the doc unchanged when the new
 * name is empty or already taken.
 */
export const renameFeed = (
  doc: LayoutDoc,
  from: string,
  to: string,
): LayoutDoc => {
  const feeds = docFeeds(doc);
  const next = sanitiseFeedName(to);
  if (next === "" || next === from) return doc;
  if (feeds.some((feed) => feed.name === next)) return doc;
  if (!feeds.some((feed) => feed.name === from)) return doc;

  // Feed names are sanitised to word characters, so nothing needs escaping.
  const pattern = new RegExp(`(\\{\\{\\s*)${from}\\.`, "g");

  return {
    ...doc,
    feeds: feeds.map((feed) =>
      feed.name === from ? { ...feed, name: next } : feed,
    ),
    elements: doc.elements.map((element) =>
      element.type === "text"
        ? { ...element, content: element.content.replace(pattern, `$1${next}.`) }
        : element,
    ),
  };
};

export const setElementFill = (
  doc: LayoutDoc,
  id: string,
  fill: FillPaint | null,
): LayoutDoc => patchElement(doc, id, { fill });

/** Solid fills only; anything else has no single colour to report. */
export const getSolidFillColor = (
  doc: LayoutDoc,
  id: string,
  fallback = "#000000",
): string => {
  const el = findElement(doc, id);
  if (el && el.fill && el.fill.type === "solid") return el.fill.color;
  return fallback;
};

// ---------------------------------------------------------------------------
// Structure. Array order is paint order: index 0 is furthest back.
// ---------------------------------------------------------------------------

export const insertElement = (
  doc: LayoutDoc,
  element: LayoutElement,
  index?: number,
): LayoutDoc => {
  const elements = [...doc.elements];
  elements.splice(index ?? elements.length, 0, element);
  return { ...doc, elements };
};

export const removeElement = (doc: LayoutDoc, id: string): LayoutDoc => ({
  ...doc,
  elements: doc.elements.filter((e) => e.id !== id),
});

export const removeElements = (doc: LayoutDoc, ids: string[]): LayoutDoc => {
  const dropped = new Set(ids);
  return {
    ...doc,
    elements: doc.elements.filter((e) => !dropped.has(e.id)),
  };
};

export const freshElementId = (
  doc: LayoutDoc,
  base: string,
  start = 1,
): string => {
  let n = start;
  let candidate = `${base}-${n}`;
  while (doc.elements.some((e) => e.id === candidate)) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
};

// The source id is already `base`, so a copy starts counting at 2.
const uniqueId = (doc: LayoutDoc, base: string): string =>
  freshElementId(doc, base, 2);

// Without this, pasting the same payload repeatedly grows the id every round:
// text-1 -> text-1-2 -> text-1-2-2.
const stripCopySuffix = (id: string): string => id.replace(/-\d+$/, "") || id;

const CASCADE_STEP = 2;

/**
 * Nudges `rect` down-right until nothing already sits at that exact origin.
 */
export const cascadeRect = (doc: LayoutDoc, rect: Rect): Rect => {
  const taken = (r: Rect) =>
    doc.elements.some((e) => e.rect.x === r.x && e.rect.y === r.y);

  let next = roundRect(clampRect(rect));
  while (taken(next)) {
    const moved = {
      ...next,
      x: next.x + CASCADE_STEP,
      y: next.y + CASCADE_STEP,
    };
    // Off the slide: clamping would bounce back onto a taken origin forever.
    if (moved.x + moved.w > 100 || moved.y + moved.h > 100) return next;
    next = roundRect(moved);
  }
  return next;
};

/** Returns the new doc and the new id, so callers can select the copy. */
export const duplicateElement = (
  doc: LayoutDoc,
  id: string,
): { doc: LayoutDoc; id: string | null } => {
  const source = findElement(doc, id);
  if (!source) return { doc, id: null };

  const copy = JSON.parse(JSON.stringify(source)) as LayoutElement;
  copy.id = uniqueId(doc, id);
  // Offset so the duplicate is visibly distinct rather than exactly stacked.
  copy.rect = {
    ...copy.rect,
    x: Math.min(copy.rect.x + 2, Math.max(0, 100 - copy.rect.w)),
    y: Math.min(copy.rect.y + 2, Math.max(0, 100 - copy.rect.h)),
  };

  const index = doc.elements.findIndex((e) => e.id === id);
  return { doc: insertElement(doc, copy, index + 1), id: copy.id };
};

/** Duplicates in paint order, so a multi-selection keeps its stacking */
export const duplicateElements = (
  doc: LayoutDoc,
  ids: string[],
): { doc: LayoutDoc; ids: string[] } => {
  const ordered = doc.elements
    .filter((e) => ids.includes(e.id))
    .map((e) => e.id);

  let next = doc;
  const created: string[] = [];
  for (const id of ordered) {
    const result = duplicateElement(next, id);
    next = result.doc;
    if (result.id) created.push(result.id);
  }
  return { doc: next, ids: created };
};

export const pasteElements = (
  doc: LayoutDoc,
  elements: LayoutElement[],
): { doc: LayoutDoc; ids: string[] } => {
  let next = doc;
  const created: string[] = [];

  for (const element of elements) {
    const copy = JSON.parse(JSON.stringify(element)) as LayoutElement;
    // Numbered from 1, not 2 as a duplicate is: the source may well be gone
    // (a cut), and reusing its id makes that round trip lossless
    copy.id = freshElementId(next, stripCopySuffix(element.id));
    copy.rect = cascadeRect(next, copy.rect);
    next = insertElement(next, copy);
    created.push(copy.id);
  }

  return { doc: next, ids: created };
};

export type ReorderDirection = "forward" | "backward" | "front" | "back";

export const reorderElement = (
  doc: LayoutDoc,
  id: string,
  direction: ReorderDirection,
): LayoutDoc => {
  const index = doc.elements.findIndex((e) => e.id === id);
  if (index === -1) return doc;

  const target =
    direction === "forward"
      ? index + 1
      : direction === "backward"
        ? index - 1
        : direction === "front"
          ? doc.elements.length - 1
          : 0;

  if (target === index || target < 0 || target >= doc.elements.length) {
    return doc;
  }

  const elements = [...doc.elements];
  const [moved] = elements.splice(index, 1);
  elements.splice(target, 0, moved!);
  return { ...doc, elements };
};

// ---------------------------------------------------------------------------

/** Identifies one video fill within a scene */
export type VideoFillKey = {
  /** Identifies the document within the scene (e.g. a slide ref). */
  scope: string;
  /** Identifies the element within that document. */
  elementId: string;
};

export const videoFillKey = ({ scope, elementId }: VideoFillKey): string =>
  `${scope}\u0000${elementId}`;

export type VideoFillElement = {
  id: string;
  label: string;
  video: VideoPaint["video"];
  playback: VideoPlaybackMode;
};

/** Every video fill in the document, in element order */
export const videoFillElements = (doc: LayoutDoc): VideoFillElement[] =>
  doc.elements.flatMap((element) =>
    element.fill?.type === "video"
      ? [
          {
            id: element.id,
            label: element.name ?? element.fill.video.title ?? "Video",
            video: element.fill.video,
            playback: element.fill.playback ?? "loop",
          },
        ]
      : [],
  );

export const audibleVideoElements = (doc: LayoutDoc): VideoFillElement[] =>
  videoFillElements(doc).filter((element) => element.playback === "once");

// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<LayoutElement["type"], string> = {
  text: "Text",
  shape: "Shape",
  host: "Live content",
};

/** Fallback for when the host has not named the element itself. */
export const hostElementDisplayName = (element: HostElement): string => {
  const { source } = element;
  switch (source.kind) {
    case "screen":
      return `Screen ${source.rendererId}`;
    case "scene":
      return `Scene on screen ${source.rendererId}`;
    case "plugin":
      return `Plugin on screen ${source.rendererId}`;
  }
};

export const elementLabel = (element: LayoutElement): string =>
  element.name ??
  (element.type === "host"
    ? hostElementDisplayName(element)
    : TYPE_LABELS[element.type]);
