import { BiblePassage, BibleVerse } from "../types";

/**
 * A slide within a passage: a contiguous run of verses shown together.
 * `start` indexes into passage.verses; `count` is how many verses it spans.
 */
export type PassageSlide = {
  start: number;
  count: number;
};

const isValidGroups = (
  groups: number[] | undefined,
  total: number,
): groups is number[] =>
  Array.isArray(groups) &&
  groups.length > 0 &&
  groups.every((n) => Number.isInteger(n) && n > 0) &&
  groups.reduce((a, b) => a + b, 0) === total;

/**
 * Resolve a passage's slides from its `slideGroups`. Falls back to one verse
 * per slide when grouping is absent or no longer adds up to the verse count
 * (e.g. the verse list changed after grouping was set).
 */
export const getPassageSlides = (passage: BiblePassage): PassageSlide[] => {
  const total = passage.verses.length;
  const sizes = isValidGroups(passage.slideGroups, total)
    ? passage.slideGroups
    : passage.verses.map(() => 1);

  const slides: PassageSlide[] = [];
  let start = 0;
  for (const count of sizes) {
    slides.push({ start, count });
    start += count;
  }
  return slides;
};

/** Number of slides the passage renders as. */
export const getPassageSlideCount = (passage: BiblePassage): number =>
  getPassageSlides(passage).length;

/** Verses shown on a given slide (empty when the index is out of range). */
export const getSlideVerses = (
  passage: BiblePassage,
  slideIndex: number,
): BibleVerse[] => {
  const slide = getPassageSlides(passage)[slideIndex];
  if (!slide) return [];
  return passage.verses.slice(slide.start, slide.start + slide.count);
};

/** Current slide sizes as a plain array (normalised, always valid). */
export const getSlideSizes = (passage: BiblePassage): number[] =>
  getPassageSlides(passage).map((s) => s.count);

/**
 * Merge the slide at `slideIndex` with the one after it. Returns the new
 * slideGroups array (unchanged when it's already the last slide).
 */
export const mergeWithNextSlide = (
  passage: BiblePassage,
  slideIndex: number,
): number[] => {
  const sizes = getSlideSizes(passage);
  if (slideIndex < 0 || slideIndex >= sizes.length - 1) return sizes;
  sizes.splice(slideIndex, 2, sizes[slideIndex]! + sizes[slideIndex + 1]!);
  return sizes;
};

/**
 * Split the slide at `slideIndex` back into one verse per slide. Returns the
 * new slideGroups array (unchanged when it already holds a single verse).
 */
export const splitSlide = (
  passage: BiblePassage,
  slideIndex: number,
): number[] => {
  const sizes = getSlideSizes(passage);
  const count = sizes[slideIndex];
  if (!count || count <= 1) return sizes;
  sizes.splice(slideIndex, 1, ...new Array(count).fill(1));
  return sizes;
};
