import { PluginBaseData, ResolvedSlide, SlideReference } from "./types";

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

  if (ref.slideIndex >= importData.thumbnailLinks.length) return null;

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
