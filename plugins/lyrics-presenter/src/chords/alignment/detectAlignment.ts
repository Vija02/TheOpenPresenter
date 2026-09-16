import { arialIndexAtWidth, arialWidth } from "./arialMetrics";

/**
 * Deciding how a chord sheet was aligned.
 * Some songs in MWL is mono, some is arial.
 */

export type AlignmentMode = "mono" | "proportional";

export type AlignmentDetection = {
  mode: AlignmentMode;
  /** Word-boundary hit rate of the monospace reading, minus a shuffled baseline. */
  monoScore: number;
  /** Same, for the proportional reading. */
  proportionalScore: number;
  /** Chord columns falling past the end of their lyric line, 0..1. */
  overflowRatio: number;
  /** Chord/lyric pairs the decision is based on. */
  sampleSize: number;
  /** False when there was too little evidence and we fell back to monospace. */
  confident: boolean;
};

/** A chord line paired with the lyric line it sits above. */
export type ChordLyricPair = { chordLine: string; lyricLine: string };

/** Column of every whitespace-separated run in a line. */
const tokenColumns = (line: string): number[] => {
  const columns: number[] = [];
  const re = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(line)) !== null) columns.push(match.index);
  return columns;
};

const wordBoundaryScore = (
  indices: number[],
  lyricLine: string,
): number | null => {
  const starts = tokenColumns(lyricLine);
  if (starts.length === 0 || indices.length === 0) return null;

  // A chord within TOLERANCE characters of a word start counts, tapering off.
  const TOLERANCE = 2;
  let total = 0;
  for (const index of indices) {
    let nearest = Infinity;
    for (const start of starts) {
      nearest = Math.min(nearest, Math.abs(index - start));
    }
    total += Math.max(0, 1 - nearest / TOLERANCE);
  }
  return total / indices.length;
};

/** Where a chord at `column` lands if the sheet was laid out in Arial. */
export const proportionalIndex = (
  chordLine: string,
  column: number,
  lyricLine: string,
): number =>
  arialIndexAtWidth(lyricLine, arialWidth(chordLine.slice(0, column)));

const mean = (values: number[]) =>
  values.reduce((acc, value) => acc + value, 0) / values.length;

export const detectAlignment = (
  pairs: ChordLyricPair[],
): AlignmentDetection => {
  const monoScores: number[] = [];
  const proportionalScores: number[] = [];
  const monoBaseline: number[] = [];
  const proportionalBaseline: number[] = [];
  let overflowHits = 0;
  let overflowTotal = 0;

  pairs.forEach(({ chordLine, lyricLine }, i) => {
    const columns = tokenColumns(chordLine);
    if (columns.length === 0) return;

    // Null model: same chords, a different line of the same song.
    const offset = Math.max(1, Math.floor(pairs.length / 2));
    const otherLyric = pairs[(i + offset) % pairs.length]!.lyricLine;

    const mono = wordBoundaryScore(columns, lyricLine);
    const proportional = wordBoundaryScore(
      columns.map((column) => proportionalIndex(chordLine, column, lyricLine)),
      lyricLine,
    );
    const monoNull = wordBoundaryScore(columns, otherLyric);
    const proportionalNull = wordBoundaryScore(
      columns.map((column) => proportionalIndex(chordLine, column, otherLyric)),
      otherLyric,
    );

    if (
      mono === null ||
      proportional === null ||
      monoNull === null ||
      proportionalNull === null
    ) {
      return;
    }

    monoScores.push(mono);
    proportionalScores.push(proportional);
    monoBaseline.push(monoNull);
    proportionalBaseline.push(proportionalNull);

    const lyricLength = lyricLine.replace(/\s+$/, "").length;
    if (lyricLength > 0) {
      overflowTotal += columns.length;
      overflowHits += columns.filter((column) => column > lyricLength).length;
    }
  });

  const sampleSize = monoScores.length;
  const overflowRatio = overflowTotal === 0 ? 0 : overflowHits / overflowTotal;

  // Too little evidence to tell. Monospace is the safe bet
  if (sampleSize < 3) {
    return {
      mode: "mono",
      monoScore: 0,
      proportionalScore: 0,
      overflowRatio,
      sampleSize,
      confident: false,
    };
  }

  const monoScore = mean(monoScores) - mean(monoBaseline);
  const proportionalScore =
    mean(proportionalScores) - mean(proportionalBaseline);

  // The proportional reading has to win by a margin
  const MARGIN = 0.05;
  const mode: AlignmentMode =
    proportionalScore > monoScore + MARGIN ? "proportional" : "mono";

  return {
    mode,
    monoScore,
    proportionalScore,
    overflowRatio,
    sampleSize,
    confident: true,
  };
};
