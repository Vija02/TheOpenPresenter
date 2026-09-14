import {
  cleanWhiteSpace,
  finalize,
  headingOf,
  isSectionWord,
  splitLines,
} from "./shared";

export const convertPcoLyrics = (content: string): string => {
  const lines: string[] = [];
  let hasHeading = false;

  for (const raw of withSlideBreaks(cleanWhiteSpace(splitLines(content)))) {
    if (raw === "-") {
      lines.push(raw);
      continue;
    }

    // Matched before chord stripping, so a bracketed heading survives
    const heading = matchHeading(raw);
    if (heading) {
      hasHeading = true;
      // The blank line before a heading ends the section, it isn't a slide
      // break within it.
      if (lines[lines.length - 1] === "-") lines.pop();
      lines.push(`[${heading}]`);
      continue;
    }

    const lyric = stripInlineChords(raw);
    if (!lyric || isChordToken(lyric)) continue;
    lines.push(lyric);
  }

  if (!hasHeading) lines.unshift("[Unknown]");

  return finalize(lines);
};

/** "[G]Amazing [D]grace" becomes "Amazing grace". */
const stripInlineChords = (line: string): string =>
  line
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Blank lines within a section separate slides, which the presenter marks "-" */
const withSlideBreaks = (lines: string[]): string[] => {
  const out: string[] = [];
  let pendingBreak = false;
  let started = false;

  for (const line of lines) {
    if (line === "") {
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
 * Nothing but chords, either "[Bm7/D]" on its own line or a plain chart's
 * chord row above the lyric. Requiring every token to parse as a chord keeps
 * real lyrics safe, since ordinary words like "Be" or "And" are not chords.
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
