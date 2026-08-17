import {
  ImportData,
  PluginBaseData,
  ResolvedSlide,
  SlideReference,
} from "./types";

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

export function getClickCountForSlide(
  pluginData: PluginBaseData,
  globalSlideIndex: number,
): number {
  return resolveSlide(pluginData, globalSlideIndex)?.clickCount ?? 0;
}

export function getTransitionDurationForSlide(
  pluginData: PluginBaseData,
  globalSlideIndex: number,
): number {
  const resolved = resolveSlide(pluginData, globalSlideIndex);
  if (!resolved) return 0;
  const { importData, localSlideIndex } = resolved;
  if (importData.type !== "googleslides") return 0;
  return importData.slideTransitionDurations?.[localSlideIndex] ?? 0;
}

export function getAutoplayDurationForSlide(
  pluginData: PluginBaseData,
  globalSlideIndex: number,
): number {
  const resolved = resolveSlide(pluginData, globalSlideIndex);
  if (!resolved) return 0;
  const { importData, localSlideIndex } = resolved;
  if (importData.type !== "googleslides") return 0;
  return importData.slideAutoplayDurations?.[localSlideIndex] ?? 0;
}

export function getClickDurationForSlide(
  pluginData: PluginBaseData,
  globalSlideIndex: number,
  clickCountIndex: number,
): number {
  const resolved = resolveSlide(pluginData, globalSlideIndex);
  if (!resolved) return 0;
  const { importData, localSlideIndex } = resolved;
  if (importData.type !== "googleslides") return 0;
  const durations = importData.slideClickDurations?.[localSlideIndex];
  return durations?.[clickCountIndex - 1] ?? 0;
}
