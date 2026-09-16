import { Accidental, isChordToken, transposeChordName } from "./chord";

/**
 * ChordPro puts chords inline, in square brackets
 * "Amazing [G]grace how [C]sweet the sound".
 *
 * Section headings are square-bracketed too, so a bracket only counts as a
 * chord when its contents parse as one and the line is not a bare heading.
 */

export type ChordProToken =
  | { type: "chord"; value: string }
  | { type: "text"; value: string };

const BRACKET_RE = /\[([^\]]*)\]/g;

/** A line that is only "[Something]" is a section heading, never a chord line. */
export const isHeadingLine = (line: string): boolean => {
  const trimmed = line.trim();
  return (
    trimmed.startsWith("[") &&
    trimmed.endsWith("]") &&
    trimmed.indexOf("]") === trimmed.length - 1
  );
};

/** True when the line carries at least one inline [chord]. */
export const hasInlineChords = (line: string): boolean => {
  if (isHeadingLine(line)) return false;
  BRACKET_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = BRACKET_RE.exec(line)) !== null) {
    if (isChordToken(match[1] ?? "")) return true;
  }
  return false;
};

export const tokenizeChordPro = (line: string): ChordProToken[] => {
  if (isHeadingLine(line)) return [{ type: "text", value: line }];

  const tokens: ChordProToken[] = [];
  let cursor = 0;

  BRACKET_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = BRACKET_RE.exec(line)) !== null) {
    const inner = match[1] ?? "";
    if (!isChordToken(inner)) continue;

    if (match.index > cursor) {
      tokens.push({ type: "text", value: line.slice(cursor, match.index) });
    }
    tokens.push({ type: "chord", value: inner });
    cursor = match.index + match[0].length;
  }

  if (cursor < line.length) {
    tokens.push({ type: "text", value: line.slice(cursor) });
  }

  return tokens;
};

/** The lyric of a ChordPro line, with every inline chord removed. */
export const stripInlineChords = (line: string): string => {
  if (!hasInlineChords(line)) return line;
  return tokenizeChordPro(line)
    .filter((token) => token.type === "text")
    .map((token) => token.value)
    .join("");
};

export const transposeChordProLine = (
  line: string,
  semitones: number,
  accidental: Accidental = "sharp",
): string => {
  if (!hasInlineChords(line)) return line;
  return tokenizeChordPro(line)
    .map((token) =>
      token.type === "chord"
        ? `[${transposeChordName(token.value, semitones, accidental)}]`
        : token.value,
    )
    .join("");
};
