import {
  Accidental,
  accidentalForKey,
  formatChord,
  parseChord,
} from "../chords/chord";

/**
 * MyWorshipList stores chords key-independently: "x00" is the tonic, "x07" the
 * fifth, "x09m7" the relative minor seventh. The number is a semitone offset
 * from the song's `original_chord`.
 */

/** "x09m7", and the bass half of "x05/x00". Stops before the next code. */
const CODE_RE = /x(\d{2})((?:(?!x\d\d)[A-Za-z0-9#+])*)/g;

export const isMwlChordCode = (token: string): boolean => /^x\d\d/.test(token);

export const contentHasMwlChordCodes = (content: string): boolean =>
  /x\d\d/.test(content ?? "");

/** Decode every "xNN" placeholder into a real chord name in `key` */
export const decodeMwlChords = (text: string, key: string | null): string => {
  const tonic = key ? parseChord(key) : null;
  if (!tonic) return text;

  const accidental: Accidental = accidentalForKey(key);

  CODE_RE.lastIndex = 0;
  return text.replace(CODE_RE, (_match, offset: string, suffix: string) => {
    const semitones = parseInt(offset, 10);
    if (Number.isNaN(semitones)) return _match;

    return formatChord(
      {
        root: (tonic.root + semitones) % 12,
        suffix,
        bass: null,
      },
      accidental,
    );
  });
};
