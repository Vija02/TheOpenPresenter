import {
  Accidental,
  accidentalForKey,
  formatChord,
  isChordToken,
  parseChord,
  transposeChord,
} from "./chord";
import {
  hasInlineChords,
  tokenizeChordPro,
  transposeChordProLine,
} from "./chordpro";
import {
  isOpenSongChordLine,
  openSongChordTokens,
  transposeOpenSongChordLine,
} from "./convert/openSongToChordPro";

/** Whole-song chord operations, for the editor. */

export const contentHasChordPro = (content: string): boolean =>
  content.split("\n").some(hasInlineChords);

/** Whether the song carries chords at all, in either format */
export const contentHasChords = (content: string): boolean =>
  content
    .split("\n")
    .some((line) => isOpenSongChordLine(line) || hasInlineChords(line));

/** Every chord used, in the order it first appears. */
export const chordsInContent = (content: string): string[] => {
  const seen = new Set<string>();
  const chords: string[] = [];

  const remember = (chord: string) => {
    if (seen.has(chord)) return;
    seen.add(chord);
    chords.push(chord);
  };

  for (const line of content.split("\n")) {
    if (isOpenSongChordLine(line)) {
      for (const token of openSongChordTokens(line)) {
        if (isChordToken(token)) remember(token);
      }
      continue;
    }

    if (!hasInlineChords(line)) continue;
    for (const token of tokenizeChordPro(line)) {
      if (token.type === "chord") remember(token.value);
    }
  }

  return chords;
};

/**
 * Best guess at the song's key, for sources that do not tell us one.
 * Prefer the key stored on the song.
 */
export const guessKey = (content: string): string | null =>
  chordsInContent(content)[0] ?? null;

export const resolveKey = (song: {
  key?: string | null;
  content: string;
}): string | null => song.key ?? guessKey(song.content);

export const transposeContent = (
  content: string,
  semitones: number,
  key?: string | null,
): string => {
  if (semitones === 0) return content;

  const accidental: Accidental = accidentalForKey(
    destinationSpelling(key ?? guessKey(content), semitones),
  );

  return content
    .split("\n")
    .map((line) =>
      isOpenSongChordLine(line)
        ? transposeOpenSongChordLine(line, semitones, accidental)
        : transposeChordProLine(line, semitones, accidental),
    )
    .join("\n");
};

export const transposeKey = (
  key: string | null | undefined,
  semitones: number,
): string | null => {
  const chord = parseChord(key ?? "");
  if (!chord) return null;

  const accidental = accidentalForKey(
    destinationSpelling(key ?? null, semitones),
  );
  return formatChord(transposeChord(chord, semitones), accidental);
};

/** Whether the destination key is conventionally written with flats. */
const destinationSpelling = (
  key: string | null,
  semitones: number,
): string | null => {
  const chord = parseChord(key ?? "");
  if (!chord) return null;

  // Prefer flats for the keys musicians conventionally write that way.
  const FLAT_PREFERRED = [1, 3, 5, 8, 10];
  const root = (((chord.root + semitones) % 12) + 12) % 12;
  return FLAT_PREFERRED.includes(root) ? "F" : "G";
};
