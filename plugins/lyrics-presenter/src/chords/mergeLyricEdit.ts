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
 * Line up the edited lyrics with the lyrics they came from.
 *
 * A plain positional pairing breaks as soon as a line is inserted or deleted:
 * every line after it pairs with its neighbour's chords. So the two sequences
 * are matched on their text instead, longest common subsequence style, and only
 * the lines that genuinely correspond are paired up.
 *
 * Returns, for each edited line, the index of the original lyric it came from,
 * or null when it is new.
 */
const alignLines = (
  originalLyrics: string[],
  editedLines: string[],
): (number | null)[] => {
  const n = originalLyrics.length;
  const m = editedLines.length;

  // lcs[i][j] = length of the longest common subsequence of the suffixes
  // starting at original i and edited j.
  const lcs: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] =
        originalLyrics[i] === editedLines[j]
          ? lcs[i + 1]![j + 1]! + 1
          : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }

  const pairing: (number | null)[] = new Array(m).fill(null);
  let i = 0;
  let j = 0;

  while (i < n && j < m) {
    if (originalLyrics[i] === editedLines[j]) {
      pairing[j] = i;
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      // The original line was deleted.
      i++;
    } else {
      // The edited line is new.
      j++;
    }
  }

  // Lines the matching could not place: an edit to an existing line leaves it
  // unequal to its original, so pair up whatever is left in order.
  let unpairedOriginal = 0;
  for (let k = 0; k < m; k++) {
    if (pairing[k] !== null) {
      unpairedOriginal = pairing[k]! + 1;
      continue;
    }

    const nextPaired = pairing.slice(k + 1).find((x) => x !== null) ?? null;
    const limit = nextPaired ?? n;
    if (unpairedOriginal < limit) {
      pairing[k] = unpairedOriginal;
      unpairedOriginal++;
    }
  }

  // A line the user split in two: the parts are new, but together they still
  // spell the original, so claim them for it rather than calling them new.
  for (let k = 0; k < m; k++) {
    const owner = pairing[k];
    if (owner === null || owner === undefined) continue;

    let span = editedLines[k]!;
    let next = k + 1;
    while (
      next < m &&
      pairing[next] === null &&
      stripSpaces(originalLyrics[owner]!).startsWith(stripSpaces(span))
    ) {
      const grown = `${span} ${editedLines[next]!}`;
      if (!stripSpaces(originalLyrics[owner]!).startsWith(stripSpaces(grown))) {
        break;
      }
      span = grown;
      pairing[next] = owner;
      next++;
    }
  }

  return pairing;
};

const stripSpaces = (value: string): string => value.replace(/\s+/g, "");

/**
 * Where `part` ends within `lyric`, starting the search at `from`. Matched
 * ignoring whitespace, since the break usually eats the space it replaced.
 */
const endOfPart = (lyric: string, from: number, part: string): number => {
  const wanted = stripSpaces(part).length;
  let seen = 0;

  for (let i = from; i < lyric.length; i++) {
    if (!/\s/.test(lyric[i]!)) seen++;
    if (seen === wanted) return i + 1;
  }

  return lyric.length;
};

/** Re-apply one line's chords across the several lines it was split into. */
const remapSplit = (original: string, parts: string[]): string[] => {
  const originalLyric = stripInlineChords(original);
  const anchors = anchorsOf(original);

  const out: string[] = [];
  let consumed = 0;

  parts.forEach((part, i) => {
    // Find where this part actually sits: splitting usually drops the space at
    // the break, so the parts do not line up with the original by length alone.
    const end =
      i === parts.length - 1
        ? originalLyric.length
        : endOfPart(originalLyric, consumed, part);

    const mine = anchors
      .filter(({ index }) => index >= consumed && index < end)
      .map(({ index, chord }) => ({ index: index - consumed, chord }));

    out.push(
      remapLine(spliceAnchors(originalLyric.slice(consumed, end), mine), part),
    );
    consumed = end;
  });

  // A chord at the very end belongs to the last part.
  const trailing = anchors.filter(({ index }) => index >= originalLyric.length);
  if (trailing.length > 0 && out.length > 0) {
    const last = out.length - 1;
    out[last] = spliceAnchors(
      stripInlineChords(out[last]!),
      anchorsOf(out[last]!).concat(
        trailing.map(({ chord }) => ({
          index: stripInlineChords(out[last]!).length,
          chord,
        })),
      ),
    );
  }

  return out;
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

  const pairing = alignLines(
    visible.map((i) => stripInlineChords(originalLines[i]!)),
    editedLines,
  );

  const out: string[] = [];
  let carried = 0; // how far through originalLines the hidden lines are copied

  const carryHiddenUpTo = (limit: number) => {
    for (let i = carried; i < limit; i++) {
      if (isChordOnlyLine(originalLines[i]!)) out.push(originalLines[i]!);
    }
    carried = Math.max(carried, limit);
  };

  let j = 0;
  while (j < editedLines.length) {
    const paired = pairing[j];

    if (paired === null || paired === undefined) {
      // A line the user added: it has no chords of its own.
      out.push(editedLines[j]!);
      j++;
      continue;
    }

    // Consecutive edited lines pairing to one original are the halves of a
    // line the user split.
    let end = j + 1;
    while (end < editedLines.length && pairing[end] === paired) end++;

    const originalIndex = visible[paired]!;
    carryHiddenUpTo(originalIndex);

    const parts = editedLines.slice(j, end);
    out.push(
      ...(parts.length === 1
        ? [remapLine(originalLines[originalIndex]!, parts[0]!)]
        : remapSplit(originalLines[originalIndex]!, parts)),
    );

    carried = originalIndex + 1;
    j = end;
  }

  // Trailing hidden chord lines belong to no visible line, so they are kept.
  carryHiddenUpTo(originalLines.length);

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
