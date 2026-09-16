import { ChordLyricPair } from "../alignment/detectAlignment";
import { isChordToken } from "../chord";

/**
 * OpenSong keeps chords on their own line, positioned by whitespace:
 *
 *   .G        C
 *   Amazing grace
 *
 * ChordPro puts them inline, where they no longer depend on the font the lyrics
 * are rendered in:
 *
 *   [G]Amazing [C]grace
 *
 * Chord lines are assumed to be monospace, so column N sits above character N.
 */

/** A line whose first character is a dot is a chord line. */
export const isOpenSongChordLine = (line: string): boolean =>
  line.startsWith(".");

const chordTextOf = (line: string): string => line.slice(1);

/**
 * Pair every chord line with the lyric line beneath it. Chord lines with no
 * lyric under them (intros, instrumental breaks) are skipped
 */
export const collectChordLyricPairs = (lines: string[]): ChordLyricPair[] => {
  const pairs: ChordLyricPair[] = [];

  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i]!;
    if (!isOpenSongChordLine(line)) continue;

    const next = lines[i + 1]!;
    if (!next.trim() || isOpenSongChordLine(next)) continue;
    if (next.trim().startsWith("[") || next.trim() === "-") continue;

    pairs.push({ chordLine: chordTextOf(line), lyricLine: next });
  }

  return pairs;
};

type PlacedChord = { index: number; chord: string };

/**
 * Chords are written above a syllable, and whoever typed the sheet was aiming
 * at one. Whitespace positioning is only accurate to a character or two, so a
 * chord landing just inside a word is pulled back to the start of it.
 *
 * A re-spaced sheet needs a little more slack, since its columns were
 * reconstructed from font metrics rather than read off directly.
 */
const SNAP_TOLERANCE = 2;
const REALIGNED_SNAP_TOLERANCE = 3;

const snapToWordStart = (
  index: number,
  lyricLine: string,
  tolerance: number,
): number => {
  if (index <= 0 || index >= lyricLine.length) return index;

  let best = index;
  let bestDistance = Infinity;

  const re = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(lyricLine)) !== null) {
    const distance = Math.abs(match.index - index);
    if (distance <= tolerance && distance < bestDistance) {
      bestDistance = distance;
      best = match.index;
    }
  }

  // The end of the line is a real target too: turnaround chords sit there.
  const toEnd = Math.abs(lyricLine.length - index);
  if (toEnd <= tolerance && toEnd < bestDistance) {
    best = lyricLine.length;
  }

  return best;
};

/** Positions a chord can sit on: every word start, plus the end of the line. */
const anchorPositions = (lyricLine: string): number[] => {
  const positions = [...lyricLine.matchAll(/\S+/g)].map((m) => m.index!);
  positions.push(lyricLine.length);
  return positions;
};

const placeChords = (
  chordText: string,
  lyricLine: string,
  tolerance: number,
): PlacedChord[] => {
  const placed: PlacedChord[] = [];
  const anchors = anchorPositions(lyricLine);
  const re = /\S+/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(chordText)) !== null) {
    // Bar lines and repeat marks have no syllable to sit on; drop them rather
    // than splicing "[|]" into the middle of a word.
    if (!isChordToken(match[0])) continue;

    const clamped = Math.max(0, Math.min(match.index, lyricLine.length));
    let index = snapToWordStart(clamped, lyricLine, tolerance);

    // Two chords must never collapse onto one syllable: that would lose the
    // order the changes happen in. Move the later one to the next word.
    if (placed.some((p) => p.index === index)) {
      const next = anchors.find((position) => position > index);
      index = next ?? lyricLine.length;
    }

    placed.push({ index, chord: match[0] });
  }

  return placed;
};

/** Splice chords into a lyric line at the given indices. */
const spliceChords = (lyricLine: string, chords: PlacedChord[]): string => {
  let result = lyricLine;

  // Right to left so earlier indices stay valid. Chords that ended up on the
  // same index keep their original order.
  const ordered = chords.map((chord, order) => ({ ...chord, order }));
  ordered.sort((a, b) =>
    b.index !== a.index ? b.index - a.index : b.order - a.order,
  );

  for (const { index, chord } of ordered) {
    result = `${result.slice(0, index)}[${chord}]${result.slice(index)}`;
  }

  return result;
};

const chordOnlyLine = (chordText: string): string =>
  (chordText.match(/\S+/g) ?? [])
    .map((token) => (isChordToken(token) ? `[${token}]` : token))
    .join(" ");

export type OpenSongToChordProOptions = {
  /**
   * Set when the chord lines were re-spaced from a proportional original, so
   * their columns are reconstructed rather than exact.
   */
  realigned?: boolean;
};

/** Convert OpenSong-style content (dot-prefixed chord lines) to ChordPro. */
export const openSongToChordPro = (
  content: string,
  options: OpenSongToChordProOptions = {},
): string => {
  const tolerance = options.realigned
    ? REALIGNED_SNAP_TOLERANCE
    : SNAP_TOLERANCE;
  const lines = content.split("\n");
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    if (!isOpenSongChordLine(line)) {
      out.push(line);
      continue;
    }

    const chordText = chordTextOf(line);
    const next = lines[i + 1];
    const canAttach =
      next !== undefined &&
      next.trim() !== "" &&
      next.trim() !== "-" &&
      !isOpenSongChordLine(next) &&
      !next.trim().startsWith("[");

    if (!canAttach) {
      const only = chordOnlyLine(chordText);
      if (only) out.push(only);
      continue;
    }

    out.push(spliceChords(next, placeChords(chordText, next, tolerance)));
    i++; // the lyric line has been consumed
  }

  return out.join("\n");
};

/** True when the content still uses dot-prefixed OpenSong chord lines. */
export const hasOpenSongChords = (content: string): boolean =>
  content.split("\n").some(isOpenSongChordLine);

/**
 * Chord tokens found in OpenSong chord lines, for callers that want to know
 * whether the "chords" are real chords or MyWorshipList placeholders.
 */
export const openSongChordTokens = (content: string): string[] =>
  content
    .split("\n")
    .filter(isOpenSongChordLine)
    .flatMap((line) => chordTextOf(line).match(/\S+/g) ?? []);

export const openSongChordsAreRealChords = (content: string): boolean => {
  const tokens = openSongChordTokens(content);
  if (tokens.length === 0) return false;
  return tokens.filter(isChordToken).length / tokens.length > 0.6;
};
