// https://www.chordpro.org/chordpro/chordpro-chords/

export type Chord = {
  /** Semitone of the root, 0 = C */
  root: number;
  /** Everything after the root: "m7", "sus4", "" for a plain major */
  suffix: string;
  /** Semitone of the bass note when written as root/bass */
  bass: number | null;
};

const NOTE_SEMITONES: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

const SHARP_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];
const FLAT_NAMES = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
];

/** Keys conventionally written with flats */
const FLAT_KEYS = new Set(["F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb"]);

export type Accidental = "sharp" | "flat";

const NOTE_RE = "[A-G](?:#|b|♯|♭)?";

const QUALITY = "(?:maj|major|min|minor|aug|dim|sus|add|alt|m|M|\\+|°|ø|∆|Δ)";
const EXTENSION = "(?:[2-9]|1[0-3])";
const ALTERATION = "(?:[#b+-](?:[2-9]|1[0-3]))";

const SUFFIX_PIECE = `(?:${QUALITY}|${EXTENSION}|${ALTERATION}|no${EXTENSION}|\\(${ALTERATION}\\)|\\(${EXTENSION}\\))`;
const SUFFIX_RE = `${SUFFIX_PIECE}*`;

const CHORD_RE = new RegExp(`^(${NOTE_RE})(${SUFFIX_RE})(?:/(${NOTE_RE}))?$`);

const noteToSemitone = (note: string): number | null => {
  const letter = note[0]?.toUpperCase();
  if (!letter) return null;
  const base = NOTE_SEMITONES[letter];
  if (base === undefined) return null;

  const accidental = note.slice(1);
  const shift =
    accidental === "#" || accidental === "♯"
      ? 1
      : accidental === "b" || accidental === "♭"
        ? -1
        : 0;

  return (((base + shift) % 12) + 12) % 12;
};

/**
 * Parse a chord token such as "Bbm7/F".
 * Returns null when the token is not a chord, so callers can use this as a test.
 */
export const parseChord = (token: string): Chord | null => {
  const trimmed = token.trim();
  if (!trimmed) return null;

  const match = CHORD_RE.exec(trimmed);
  if (!match) return null;

  const root = noteToSemitone(match[1]!);
  if (root === null) return null;

  const suffix = match[2] ?? "";

  const bass = match[3] ? noteToSemitone(match[3]) : null;
  if (match[3] && bass === null) return null;

  return { root, suffix, bass };
};

export const isChordToken = (token: string): boolean =>
  parseChord(token) !== null;

/** Accidental preference implied by a key such as "Eb" or "F#m". */
export const accidentalForKey = (
  key: string | null | undefined,
): Accidental => {
  if (!key) return "sharp";
  const match = new RegExp(`^(${NOTE_RE})`).exec(key.trim());
  if (!match) return "sharp";

  const root = match[1]!.replace("♯", "#").replace("♭", "b");
  const isMinor = /m(?!aj)/.test(key.slice(root.length));

  if (root.includes("b")) return "flat";
  if (root.includes("#")) return "sharp";

  // Natural roots: relative minors of flat keys are flat keys too (Dm, Gm, Cm).
  if (isMinor) return ["D", "G", "C", "F"].includes(root) ? "flat" : "sharp";
  return FLAT_KEYS.has(root) ? "flat" : "sharp";
};

const semitoneToNote = (semitone: number, accidental: Accidental): string => {
  const index = (((semitone % 12) + 12) % 12) as number;
  return (accidental === "flat" ? FLAT_NAMES : SHARP_NAMES)[index]!;
};

export const formatChord = (
  chord: Chord,
  accidental: Accidental = "sharp",
): string => {
  const root = semitoneToNote(chord.root, accidental);
  const bass =
    chord.bass === null ? "" : `/${semitoneToNote(chord.bass, accidental)}`;
  return `${root}${chord.suffix}${bass}`;
};

export const transposeChord = (chord: Chord, semitones: number): Chord => ({
  root: (((chord.root + semitones) % 12) + 12) % 12,
  suffix: chord.suffix,
  bass:
    chord.bass === null ? null : (((chord.bass + semitones) % 12) + 12) % 12,
});

/** Transpose a written chord, keeping it readable in the destination key. */
export const transposeChordName = (
  name: string,
  semitones: number,
  accidental: Accidental = "sharp",
): string => {
  const chord = parseChord(name);
  if (!chord) return name;
  return formatChord(transposeChord(chord, semitones), accidental);
};

/** Semitone distance from one written key to another, e.g. "G" -> "A" is 2. */
export const semitonesBetweenKeys = (from: string, to: string): number => {
  const a = parseChord(from);
  const b = parseChord(to);
  if (!a || !b) return 0;
  return (((b.root - a.root) % 12) + 12) % 12;
};
