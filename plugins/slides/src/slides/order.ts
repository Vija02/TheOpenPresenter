import {
  DisplayMode,
  GoogleSlidesImportData,
  ImportData,
  PluginBaseData,
  ResolvedSlide,
  SlideReference,
  getEffectiveDisplayMode,
  isAnimatedDisplayMode,
} from "../types";

export function getImportSlideCount(importData: ImportData): number {
  return importData.type === "custom"
    ? importData.docs.length
    : importData.thumbnailLinks.length;
}

export function createSlideRef(importId: string, slideIndex: number): string {
  return `${importId}:${slideIndex}`;
}

export function parseSlideRef(ref: string): SlideReference {
  const colonIndex = ref.indexOf(":");
  if (colonIndex === -1) {
    throw new Error(`Invalid slide reference: ${ref}`);
  }
  const slideIndex = Number(ref.substring(colonIndex + 1));
  if (!Number.isInteger(slideIndex) || slideIndex < 0) {
    throw new Error(`Invalid slide reference (bad index): ${ref}`);
  }
  return {
    importId: ref.substring(0, colonIndex),
    slideIndex,
  };
}

/**
 * Resolve a slide reference at `globalSlideIndex` to full slide info,
 * or null if the import or slide is missing.
 */
export function resolveSlide(
  pluginData: PluginBaseData,
  globalSlideIndex: number,
): ResolvedSlide | null {
  const reference = pluginData.slideOrder[globalSlideIndex];
  if (!reference) return null;

  const ref = parseSlideRef(reference);
  const importData = pluginData.imports[ref.importId];
  if (!importData) return null;

  if (ref.slideIndex >= getImportSlideCount(importData)) return null;

  return {
    globalSlideIndex,
    rawRef: reference,
    ref,
    importData,
    localSlideIndex: ref.slideIndex,
    thumbnailUrl: importData.thumbnailLinks[ref.slideIndex] ?? "",
    clickCount: importData.slideClickCounts[ref.slideIndex] ?? 0,
  };
}

type DisplayModes = Record<string, DisplayMode> | undefined;

/**
 * The slide, if it is shown in a mode that plays builds. A slide shown as an
 * image has no clicks or timings, whatever was imported.
 */
function resolveAnimatedSlide(
  pluginData: PluginBaseData,
  globalSlideIndex: number,
  displayModes: DisplayModes,
): ResolvedSlide | null {
  const resolved = resolveSlide(pluginData, globalSlideIndex);
  if (!resolved) return null;
  const mode = getEffectiveDisplayMode(resolved.importData, displayModes);
  return isAnimatedDisplayMode(mode) ? resolved : null;
}

type SlideTimings = Pick<
  GoogleSlidesImportData,
  "slideTransitionDurations" | "slideClickDurations" | "slideAutoplayDurations"
>;

const slideTimings = (importData: ImportData): SlideTimings =>
  importData.type === "googleslides" || importData.type === "ppt"
    ? importData
    : {};

export function getEmbedClickCount(
  importData: ImportData,
  localSlideIndex: number,
): number {
  const tracked = importData.slideClickCounts[localSlideIndex] ?? 0;
  if (importData.type !== "googleslides") return tracked;
  return (
    importData.slideVideos?.[String(localSlideIndex)]?.embedClicks ?? tracked
  );
}

/** `getEmbedClickCount` for every slide of an import */
export const getEmbedClickCounts = (importData: ImportData): number[] =>
  importData.slideClickCounts.map((_, i) => getEmbedClickCount(importData, i));

export function getEmbedClickCountForSlide(
  pluginData: PluginBaseData,
  globalSlideIndex: number,
  displayModes?: DisplayModes,
): number {
  const resolved = resolveAnimatedSlide(
    pluginData,
    globalSlideIndex,
    displayModes,
  );
  if (!resolved) return 0;
  return getEmbedClickCount(resolved.importData, resolved.localSlideIndex);
}

export function embedVideoFinish(
  importData: ImportData,
  localSlideIndex: number,
  embedClick: number,
): "right" | "rightLeft" | null {
  if (importData.type !== "googleslides" || embedClick < 0) return null;
  const steps = importData.slideVideos?.[String(localSlideIndex)];
  if (!steps) return null;

  // Past the embed's own steps are our manual ones, which it never plays
  const startsHere =
    embedClick <= steps.embedClicks &&
    Object.values(steps.startClicks).includes(embedClick);
  if (!startsHere) return null;
  return embedClick < steps.embedClicks ? "rightLeft" : "right";
}

/** Where the embed is when we're at `clickCount`. Keeps -1 (autoplay rewind) */
export const toEmbedClickCount = (clickCount: number, embedClicks: number) =>
  Math.min(clickCount, embedClicks);

export function getClickCountForSlide(
  pluginData: PluginBaseData,
  globalSlideIndex: number,
  displayModes?: DisplayModes,
): number {
  return (
    resolveAnimatedSlide(pluginData, globalSlideIndex, displayModes)
      ?.clickCount ?? 0
  );
}

export function getTransitionDurationForSlide(
  pluginData: PluginBaseData,
  globalSlideIndex: number,
  displayModes?: DisplayModes,
): number {
  const resolved = resolveAnimatedSlide(
    pluginData,
    globalSlideIndex,
    displayModes,
  );
  if (!resolved) return 0;
  return (
    slideTimings(resolved.importData).slideTransitionDurations?.[
      resolved.localSlideIndex
    ] ?? 0
  );
}

export function getAutoplayDurationForSlide(
  pluginData: PluginBaseData,
  globalSlideIndex: number,
  displayModes?: DisplayModes,
): number {
  const resolved = resolveAnimatedSlide(
    pluginData,
    globalSlideIndex,
    displayModes,
  );
  if (!resolved) return 0;
  return (
    slideTimings(resolved.importData).slideAutoplayDurations?.[
      resolved.localSlideIndex
    ] ?? 0
  );
}

export function getClickDurationForSlide(
  pluginData: PluginBaseData,
  globalSlideIndex: number,
  clickCountIndex: number,
  displayModes?: DisplayModes,
): number {
  const resolved = resolveAnimatedSlide(
    pluginData,
    globalSlideIndex,
    displayModes,
  );
  if (!resolved) return 0;
  const durations = slideTimings(resolved.importData).slideClickDurations?.[
    resolved.localSlideIndex
  ];
  return durations?.[clickCountIndex - 1] ?? 0;
}
