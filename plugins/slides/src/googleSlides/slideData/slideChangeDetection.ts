import { extractDocData, extractSlideData } from "./slideDataExtractor";
import { SlideChange, SlideDigest, SlideInfo } from "./types";

/**
 * Extracts the raw slide data array for a specific slide by its ID
 * This is useful for comparison to detect changes
 */
export function extractRawSlideData(
  html: string,
  slideId: string,
): any[] | null {
  const docData = extractDocData(html);
  if (!docData || docData.length < 2) return null;

  const slidesArray = docData[1];
  for (const slide of slidesArray) {
    if (slide && slide[0] === slideId) {
      return slide;
    }
  }
  return null;
}

/**
 * Generates a hash/fingerprint of a slide's content for quick comparison
 * This includes both the docData and SVG content
 */
export function generateSlideFingerprint(
  html: string,
  slideId: string,
): string | null {
  const rawData = extractRawSlideData(html, slideId);
  if (!rawData) return null;

  // Create a deterministic string representation
  const dataStr = JSON.stringify(rawData);

  // Simple hash function (djb2)
  let hash = 5381;
  for (let i = 0; i < dataStr.length; i++) {
    hash = (hash * 33) ^ dataStr.charCodeAt(i);
  }

  return (hash >>> 0).toString(16);
}

/**
 * Compares two HTML documents and returns the list of changed slides
 */
export function detectSlideChanges(
  oldHtml: string,
  newHtml: string,
): SlideChange[] {
  const oldData = extractSlideData(oldHtml);
  const newData = extractSlideData(newHtml);

  if (!oldData || !newData) {
    return [];
  }

  const changes: SlideChange[] = [];

  // Create maps for quick lookup
  const oldSlides = new Map<string, SlideInfo>();
  const newSlides = new Map<string, SlideInfo>();

  for (const slide of oldData.slides) {
    oldSlides.set(slide.slideId, slide);
  }
  for (const slide of newData.slides) {
    newSlides.set(slide.slideId, slide);
  }

  // Check for removed and modified slides
  for (const [slideId, oldSlide] of oldSlides) {
    const newSlide = newSlides.get(slideId);

    if (!newSlide) {
      // Slide was removed
      changes.push({
        slideId,
        slideIndex: oldSlide.slideIndex,
        changeType: "removed",
        oldFingerprint: generateSlideFingerprint(oldHtml, slideId) ?? undefined,
      });
    } else {
      // Check if slide was modified
      const oldFingerprint = generateSlideFingerprint(oldHtml, slideId);
      const newFingerprint = generateSlideFingerprint(newHtml, slideId);

      if (oldFingerprint !== newFingerprint) {
        changes.push({
          slideId,
          slideIndex: newSlide.slideIndex,
          changeType: "modified",
          oldFingerprint: oldFingerprint ?? undefined,
          newFingerprint: newFingerprint ?? undefined,
        });
      }
    }
  }

  // Check for added slides
  for (const [slideId, newSlide] of newSlides) {
    if (!oldSlides.has(slideId)) {
      changes.push({
        slideId,
        slideIndex: newSlide.slideIndex,
        changeType: "added",
        newFingerprint: generateSlideFingerprint(newHtml, slideId) ?? undefined,
      });
    }
  }

  // Sort by slide index
  changes.sort((a, b) => a.slideIndex - b.slideIndex);

  return changes;
}

/**
 * Gets a map of slideId -> fingerprint for all slides in the HTML
 */
export function getAllSlideFingerprints(
  html: string,
): Map<string, string> | null {
  const data = extractSlideData(html);
  if (!data) return null;

  const fingerprints = new Map<string, string>();

  for (const slide of data.slides) {
    const fingerprint = generateSlideFingerprint(html, slide.slideId);
    if (fingerprint) {
      fingerprints.set(slide.slideId, fingerprint);
    }
  }

  return fingerprints;
}

/**
 * Gets a digest of all slides for quick comparison
 */
export function getSlideDigests(html: string): SlideDigest[] | null {
  const data = extractSlideData(html);
  if (!data) return null;

  return data.slides.map((slide) => ({
    slideId: slide.slideId,
    slideIndex: slide.slideIndex,
    title: slide.title,
    clickCount: slide.clickCount,
    hasVideo: slide.videos.length > 0,
    imageCount: slide.imageUrls.length,
    fingerprint: generateSlideFingerprint(html, slide.slideId) ?? "",
  }));
}

/**
 * Compares two slide digests and returns true if they're different
 */
export function hasSlideChanged(
  oldDigest: SlideDigest,
  newDigest: SlideDigest,
): boolean {
  return oldDigest.fingerprint !== newDigest.fingerprint;
}

/**
 * Extracts only the changed slide IDs between two HTML documents
 * Returns slide IDs that need to be updated
 */
export function getChangedSlideIds(
  oldHtml: string,
  newHtml: string,
): {
  added: string[];
  removed: string[];
  modified: string[];
} {
  const changes = detectSlideChanges(oldHtml, newHtml);

  return {
    added: changes
      .filter((c) => c.changeType === "added")
      .map((c) => c.slideId),
    removed: changes
      .filter((c) => c.changeType === "removed")
      .map((c) => c.slideId),
    modified: changes
      .filter((c) => c.changeType === "modified")
      .map((c) => c.slideId),
  };
}
