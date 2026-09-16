import {
  hasInlineChords,
  stripInlineChords,
  tokenizeChordPro,
} from "./chordpro";
import { isOpenSongChordLine } from "./convert/openSongToChordPro";

/**
 * Editing lyrics while chords are hidden.
 *
 * The editor can show lyrics without their chords, which is far easier to read,
 * but the chords still have to survive whatever the user types. The chorded
 * text stays the source of truth and edits are merged back into it:
 *
 *   - an untouched line keeps its chords exactly
 *   - an edited line keeps the chords whose anchor text survived
 *   - inserted and deleted lines are matched on lyric text
 *
 * A chord is only ever dropped, never moved somewhere the user did not put it.
 */

type Anchored = { index: number; chord: string };

const anchorsOf = (line: string): Anchored[] => {
  const anchors: Anchored[] = [];
  let offset = 0;

  for (const token of tokenizeChordPro(line)) {
    if (token.type === "chord") {
      anchors.push({ index: offset, chord: token.value });
    } else {
      offset += token.value.length;
    }
  }

  return anchors;
};

const spliceAnchors = (lyric: string, anchors: Anchored[]): string => {
  let result = lyric;

  for (const { index, chord } of [...anchors].sort(
    (a, b) => b.index - a.index,
  )) {
    const at = Math.max(0, Math.min(index, result.length));
    result = `${result.slice(0, at)}[${chord}]${result.slice(at)}`;
  }

  return result;
};

/** Re-apply a line's chords to an edited version of its lyric */
const remapLine = (original: string, editedLyric: string): string => {
  const originalLyric = stripInlineChords(original);
  if (originalLyric === editedLyric) return original;

  const anchors = anchorsOf(original);
  if (anchors.length === 0) return editedLyric;

  // Length of the untouched head and tail of the line.
  let head = 0;
  while (
    head < originalLyric.length &&
    head < editedLyric.length &&
    originalLyric[head] === editedLyric[head]
  ) {
    head++;
  }

  let tail = 0;
  while (
    tail < originalLyric.length - head &&
    tail < editedLyric.length - head &&
    originalLyric[originalLyric.length - 1 - tail] ===
      editedLyric[editedLyric.length - 1 - tail]
  ) {
    tail++;
  }

  const delta = editedLyric.length - originalLyric.length;

  const moved = anchors
    .map(({ index, chord }) => {
      // Before the edit: position is unchanged.
      if (index <= head) return { index, chord };
      // After the edit: position shifts by the length change.
      if (index >= originalLyric.length - tail) {
        return { index: index + delta, chord };
      }
      // Inside the edited span: the text it was attached to is gone.
      return null;
    })
    .filter((anchor): anchor is Anchored => anchor !== null)
    .filter(({ index }) => index >= 0 && index <= editedLyric.length);

  return spliceAnchors(editedLyric, moved);
};

/**
 * Merge a chords-hidden edit back into the chorded content. `original` is the
 * full chorded text, `editedLyrics` is what the user edited, chords stripped.
 */
export const mergeLyricEdit = (
  original: string,
  editedLyrics: string,
): string => {
  const originalLines = original.split("\n");
  const editedLines = editedLyrics.split("\n");

  // Lines the user can see: chord-only lines are hidden, so they are not part
  // of the edited text and must be carried across untouched.
  const visible: number[] = [];
  originalLines.forEach((line, i) => {
    if (isChordOnlyLine(line)) return;
    visible.push(i);
  });

  const out: string[] = [];
  let cursor = 0; // index into `visible`

  for (const editedLine of editedLines) {
    // Carry across any hidden chord-only lines that come before this line.
    const nextVisible = visible[cursor];
    const start = cursor === 0 ? 0 : visible[cursor - 1]! + 1;
    if (nextVisible !== undefined) {
      for (let i = start; i < nextVisible; i++) {
        if (isChordOnlyLine(originalLines[i]!)) out.push(originalLines[i]!);
      }
    }

    if (nextVisible === undefined) {
      // The user added lines at the end: nothing to merge them with.
      out.push(editedLine);
      continue;
    }

    out.push(remapLine(originalLines[nextVisible]!, editedLine));
    cursor++;
  }

  // Anything left over was deleted by the user, except trailing chord-only
  // lines, which belong to no visible line and are kept.
  const lastVisible = cursor === 0 ? -1 : visible[cursor - 1]!;
  if (cursor >= visible.length) {
    for (let i = lastVisible + 1; i < originalLines.length; i++) {
      if (isChordOnlyLine(originalLines[i]!)) out.push(originalLines[i]!);
    }
  }

  return out.join("\n");
};

/**
 * A line that carries no lyric: an inline chord-only line like "[G] [C] [D]",
 * or an OpenSong chord line like ".| D /// | Em / D / |".
 */
export const isChordOnlyLine = (line: string): boolean =>
  isOpenSongChordLine(line) ||
  (hasInlineChords(line) && stripInlineChords(line).trim() === "");

/** The chords-hidden view of the content the editor shows the user. */
export const toLyricsOnly = (content: string): string =>
  content
    .split("\n")
    .filter((line) => !isChordOnlyLine(line))
    .map(stripInlineChords)
    .join("\n");
