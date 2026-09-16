import {
  isOpenSongChordLine,
  openSongToChordPro,
} from "../chords/convert/openSongToChordPro";
import {
  cleanWhiteSpace,
  finalize,
  headingOf,
  isSectionWord,
  splitLines,
} from "./shared";

/**
 * A Planning Center chord chart is either already ChordPro, or chords on their
 * own line positioned by whitespace:
 *
 *   D          G      D
 *   Amazing grace how sweet the sound
 *
 * Both end up as ChordPro. The positional form is marked up as OpenSong chord
 * lines first, since that is the same shape.
 */

export const convertPcoLyrics = (content: string): string => {
  const lines: string[] = [];
  let hasHeading = false;

  // Chord columns are counted in characters, so the whitespace has to survive
  // until the chords have been moved inline.
  for (const raw of withSlideBreaks(markChordLines(splitLines(content)))) {
    if (raw === "-") {
      lines.push(raw);
      continue;
    }

    if (isOpenSongChordLine(raw)) {
      lines.push(raw);
      continue;
    }

    const heading = matchHeading(raw);
    if (heading) {
      hasHeading = true;
      // The blank line before a heading ends the section, it isn't a slide
      // break within it.
      if (lines[lines.length - 1] === "-") lines.pop();
      lines.push(`[${heading}]`);
      continue;
    }

    // Nothing left once the chords come off means there is nothing to sing.
    if (!stripInlineChords(raw)) continue;
    lines.push(raw);
  }

  if (!hasHeading) lines.unshift("[Unknown]");

  return finalize(
    cleanWhiteSpace(openSongToChordPro(lines.join("\n")).split("\n")),
  );
};

const stripInlineChords = (line: string): string =>
  line
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * A chord row above a lyric becomes an OpenSong chord line. Headings are
 * matched first, or a bare "D" section marker would read as a chord.
 */
const markChordLines = (lines: string[]): string[] =>
  lines.map((line) =>
    !matchHeading(line) && isChordToken(line) ? `.${line}` : line,
  );

/** Blank lines within a section separate slides, which we mark "-" */
const withSlideBreaks = (lines: string[]): string[] => {
  const out: string[] = [];
  let pendingBreak = false;
  let started = false;

  for (const line of lines) {
    if (line.trim() === "") {
      if (started) pendingBreak = true;
      continue;
    }

    if (pendingBreak) {
      out.push("-");
      pendingBreak = false;
    }
    out.push(line);
    started = true;
  }

  return out;
};

const BRACKET_LINE_RE = /^\s*\[([^\]]*)\]\s*$/;

const CHORD_RE =
  /^[A-G](#|b)?(maj|min|m|sus|aug|dim|add|M)?\d*(\/[A-G](#|b)?)?$/;

/**
 * Requiring every token to parse as a chord keeps real lyrics safe, since
 * ordinary words like "Be" or "And" are not chords.
 */
const isChordToken = (value: string) => {
  const tokens = value.trim().split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.every((token) => CHORD_RE.test(token));
};

const matchHeading = (line: string): string | null => {
  const bracketed = line.match(BRACKET_LINE_RE);
  if (bracketed) {
    const inner = (bracketed[1] ?? "").trim();
    if (!inner) return null;
    // A lone chord in brackets is ChordPro markup, not a section
    if (!isSectionWord(inner) && isChordToken(inner)) return null;
    return inner;
  }

  return headingOf(line);
};
