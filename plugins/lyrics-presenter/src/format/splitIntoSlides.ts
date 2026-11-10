import { isChordToken } from "../chords/chord";
import { isHeadingLine } from "../chords/chordpro";
import { isChordOnlyLine } from "../chords/mergeLyricEdit";

const isLoneChord = (line: string): boolean =>
  isHeadingLine(line) && isChordToken(line.trim().slice(1, -1));

const isHeading = (line: string): boolean =>
  isHeadingLine(line) && !isLoneChord(line);

const isChordsOnly = (line: string): boolean =>
  isChordOnlyLine(line) || isLoneChord(line);

/**
 * Regroup every section into slides of `linesPerSlide` lyric lines, replacing
 * the slide breaks already there. Chord lines carry no lyric, so they do not
 * count, and a break never comes between one and the lyric beneath it.
 */
export const splitIntoSlides = (
  content: string,
  linesPerSlide: number,
): string => {
  const out: string[] = [];
  let inSlide = 0;
  /** Where the chord lines waiting for the next lyric begin. */
  let chordsFrom: number | null = null;

  for (const line of content.split("\n")) {
    if (line.trim() === "-") continue;

    if (isHeading(line)) {
      inSlide = 0;
      chordsFrom = null;
      out.push(line);
      continue;
    }

    if (line.trim() === "") {
      chordsFrom = null;
      out.push(line);
      continue;
    }

    if (isChordsOnly(line)) {
      chordsFrom ??= out.length;
      out.push(line);
      continue;
    }

    if (inSlide === linesPerSlide) {
      out.splice(chordsFrom ?? out.length, 0, "-");
      inSlide = 0;
    }
    inSlide++;
    chordsFrom = null;
    out.push(line);
  }

  return out.join("\n");
};
