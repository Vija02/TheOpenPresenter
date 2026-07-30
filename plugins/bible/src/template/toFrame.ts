import { FrameData, Span, span } from "@repo/layout";

import { deriveAbbreviation } from "../helpers/abbreviation";
import { getSlideVerses } from "../helpers/slides";
import { BiblePassage, BibleVerse } from "../types";

/** Collapse a slide's verses to a range */
const slideReference = (
  passage: BiblePassage,
  verses: BibleVerse[],
): string => {
  const first = verses[0];
  const last = verses[verses.length - 1];
  if (!first || !last) return passage.reference;

  if (verses.length === 1) {
    return `${first.bookName} ${first.chapter}:${first.verse}`;
  }
  return first.chapter === last.chapter
    ? `${first.bookName} ${first.chapter}:${first.verse}-${last.verse}`
    : `${first.bookName} ${first.chapter}:${first.verse}-${last.chapter}:${last.verse}`;
};

export type FrameOptions = {
  showVerseNumbers?: boolean;
};

/** Shape data for rendering */
export const passageToFrame = (
  passage: BiblePassage,
  slideIndex: number,
  { showVerseNumbers = false }: FrameOptions = {},
): FrameData => {
  const verses = getSlideVerses(passage, slideIndex);

  const spans: Span[] = [];
  verses.forEach((verse, i) => {
    if (i > 0) spans.push(span(" "));
    if (showVerseNumbers) spans.push(span(String(verse.verse), "verseNumber"));
    spans.push(span(verse.text));
  });

  return {
    verses: spans,
    reference: verses.length > 0 ? slideReference(passage, verses) : "",
    translation:
      passage.translationAbbreviation ||
      deriveAbbreviation(passage.translationName),
  };
};
