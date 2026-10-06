/**
 * Multi-column flow for the `columns` fit mode. Pure: the DOM measuring lives
 * in `react/text/columns.ts`, which feeds this the numbers.
 *
 * Text is split into lines on newlines, and lines into blocks on blank lines.
 * Lines never wrap, so every dimension scales linearly with the font size.
 * That is what lets the whole search run on numbers measured once at a
 * reference size, instead of re-laying-out the DOM for every candidate.
 */
import { Span } from "../template/spans";

export type TextLine = Span[];
/** A run of lines that is kept together in one column where possible. */
export type TextBlock = TextLine[];

const isBlankLine = (line: TextLine): boolean =>
  line.every((s) => s.text.trim() === "");

/**
 * Lines split on `\n`, blocks on one or more blank lines. A span crossing a
 * newline is cut in two with its role kept on both halves.
 */
export const spansToBlocks = (spans: Span[]): TextBlock[] => {
  const lines: TextLine[] = [[]];
  for (const s of spans) {
    s.text
      .replace(/\r/g, "")
      .split("\n")
      .forEach((part, i) => {
        if (i > 0) lines.push([]);
        if (part !== "") lines[lines.length - 1]!.push({ ...s, text: part });
      });
  }

  const blocks: TextBlock[] = [];
  let current: TextBlock = [];
  for (const line of lines) {
    if (!isBlankLine(line)) {
      current.push(line);
    } else if (current.length > 0) {
      blocks.push(current);
      current = [];
    }
  }
  if (current.length > 0) blocks.push(current);
  return blocks;
};

export type LineMetrics = { width: number; height: number };

/** Addresses one line of the input. */
export type LineRef = { block: number; line: number };

export type ColumnPlan = {
  /** Multiplier on the reference size the metrics were measured at. */
  scale: number;
  /** Lines in reading order. A column may start part way through a block. */
  columns: LineRef[][];
};

export type ColumnSolveInput = {
  /** Per block, per line, measured at the reference font size. */
  blocks: LineMetrics[][];
  /** Space between two blocks sharing a column, at the reference size. */
  blockSpacing: number;
  /** Space available, px. */
  width: number;
  height: number;
  /** Px between columns. Fixed, so it does not scale with the text. */
  columnGap: number;
  maxColumns: number;
};

/**
 * A split block keeps at least this many lines on each side of the break, so a
 * heading is never stranded at the foot of a column away from its first line.
 */
export const MIN_SPLIT_LINES = 2;

/**
 * How much bigger splitting blocks has to make the text before it is used.
 * Splitting a section across columns is harder to read, so it is a fallback
 * for when one long block would otherwise shrink everything.
 */
export const SPLIT_GAIN = 1.25;

/** A column count is only worth adding if it buys at least this much. */
const COLUMN_GAIN = 1.01;

type FlatLine = LineRef & LineMetrics;

type Candidate = { scale: number; breaks: number[] };

/**
 * Best plan for exactly `k` columns over the allowed break positions.
 *
 * For a given partition the scale is `min(A / Σwidths, H / max height)`. Fix a
 * cap T on column height and the best partition is the one minimising the
 * width sum, which is a small DP. As T grows the width term can only improve
 * and the height term only worsens, so the optimum sits where they cross, and
 * a binary search over the candidate heights finds it.
 */
const solveForK = (
  k: number,
  m: number,
  rangeHeight: Float64Array,
  rangeWidth: Float64Array,
  thresholds: number[],
  availableWidth: number,
  availableHeight: number,
): Candidate | null => {
  if (k > m - 1 || availableWidth <= 0) return null;

  const at = (a: number, b: number) => a * m + b;

  /** Minimum width sum with every column at most `cap` tall. */
  const minWidthSum = (cap: number) => {
    let prev = new Float64Array(m).fill(Infinity);
    prev[0] = 0;
    const parents: Int32Array[] = [];

    for (let c = 1; c <= k; c++) {
      const next = new Float64Array(m).fill(Infinity);
      const parent = new Int32Array(m).fill(-1);
      for (let b = 1; b < m; b++) {
        for (let a = 0; a < b; a++) {
          if (prev[a] === Infinity || rangeHeight[at(a, b)]! > cap) continue;
          const total = prev[a]! + rangeWidth[at(a, b)]!;
          if (total < next[b]!) {
            next[b] = total;
            parent[b] = a;
          }
        }
      }
      parents.push(parent);
      prev = next;
    }

    return { sum: prev[m - 1]!, parents };
  };

  const scaleAt = (index: number) => {
    const cap = thresholds[index]!;
    const { sum } = minWidthSum(cap);
    const widthScale = sum === Infinity ? 0 : availableWidth / sum;
    return { widthScale, heightScale: availableHeight / cap };
  };

  // First threshold at which width stops being the tighter constraint.
  let lo = 0;
  let hi = thresholds.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const { widthScale, heightScale } = scaleAt(mid);
    if (widthScale >= heightScale) hi = mid;
    else lo = mid + 1;
  }

  let best: Candidate | null = null;
  for (const index of [lo - 1, lo]) {
    if (index < 0) continue;
    const { sum, parents } = minWidthSum(thresholds[index]!);
    if (sum === Infinity) continue;

    const breaks = [m - 1];
    for (let c = k - 1; c >= 0; c--) {
      breaks.unshift(parents[c]![breaks[0]!]!);
    }

    // Scored on the partition itself: its tallest column may sit below the cap.
    let widthSum = 0;
    let tallest = 0;
    for (let i = 0; i < k; i++) {
      widthSum += rangeWidth[at(breaks[i]!, breaks[i + 1]!)]!;
      tallest = Math.max(tallest, rangeHeight[at(breaks[i]!, breaks[i + 1]!)]!);
    }
    const scale = Math.min(
      availableWidth / widthSum,
      availableHeight / tallest,
    );
    if (!best || scale > best.scale) best = { scale, breaks };
  }

  return best;
};

const solve = (
  input: ColumnSolveInput,
  flat: FlatLine[],
  allowSplit: boolean,
): ColumnPlan | null => {
  const blockLength = (block: number) => input.blocks[block]!.length;

  // Indices into `flat` where a column may start, bracketed by 0 and n.
  const positions = [0];
  for (let p = 1; p < flat.length; p++) {
    const line = flat[p]!;
    const newBlock = line.block !== flat[p - 1]!.block;
    const splitsWell =
      allowSplit &&
      line.line >= MIN_SPLIT_LINES &&
      blockLength(line.block) - line.line >= MIN_SPLIT_LINES;
    if (newBlock || splitsWell) positions.push(p);
  }
  positions.push(flat.length);

  const m = positions.length;
  const rangeHeight = new Float64Array(m * m);
  const rangeWidth = new Float64Array(m * m);
  const heights = new Set<number>();

  const prefix = [0];
  for (const line of flat)
    prefix.push(prefix[prefix.length - 1]! + line.height);

  for (let a = 0; a < m; a++) {
    let width = 0;
    let lineIndex = positions[a]!;
    for (let b = a + 1; b < m; b++) {
      const end = positions[b]!;
      for (; lineIndex < end; lineIndex++) {
        width = Math.max(width, flat[lineIndex]!.width);
      }
      const start = positions[a]!;
      const gaps = flat[end - 1]!.block - flat[start]!.block;
      const height = prefix[end]! - prefix[start]! + gaps * input.blockSpacing;
      rangeHeight[a * m + b] = height;
      rangeWidth[a * m + b] = width;
      heights.add(height);
    }
  }

  const thresholds = [...heights].sort((x, y) => x - y);

  let best: Candidate | null = null;
  for (let k = 1; k <= input.maxColumns; k++) {
    const candidate = solveForK(
      k,
      m,
      rangeHeight,
      rangeWidth,
      thresholds,
      input.width - input.columnGap * (k - 1),
      input.height,
    );
    if (!candidate) continue;
    if (!best || candidate.scale > best.scale * COLUMN_GAIN) best = candidate;
  }

  if (!best || !(best.scale > 0)) return null;

  const columns: LineRef[][] = [];
  for (let i = 0; i < best.breaks.length - 1; i++) {
    const from = positions[best.breaks[i]!]!;
    const to = positions[best.breaks[i + 1]!]!;
    columns.push(
      flat.slice(from, to).map(({ block, line }) => ({ block, line })),
    );
  }

  return { scale: best.scale, columns };
};

/**
 * The partition into at most `maxColumns` columns that lets the text be
 * largest. Blocks stay whole unless splitting one wins by `SPLIT_GAIN`.
 *
 * Columns may differ in width, since each is only as wide as its longest line.
 * Giving every column the width of the widest, as lyrics-presenter does, wastes
 * the space a column of short lines leaves beside it.
 *
 * `null` when there is nothing to lay out or no room to put it.
 */
export const solveColumns = (input: ColumnSolveInput): ColumnPlan | null => {
  if (input.width <= 0 || input.height <= 0) return null;

  const flat: FlatLine[] = input.blocks.flatMap((lines, block) =>
    lines.map((metrics, line) => ({ block, line, ...metrics })),
  );
  if (flat.length === 0) return null;

  const whole = solve(input, flat, false);
  const splittable = input.blocks.some(
    (lines) => lines.length >= MIN_SPLIT_LINES * 2,
  );
  if (!splittable || input.maxColumns < 2) return whole;

  const split = solve(input, flat, true);
  if (!whole) return split;
  if (split && split.scale > whole.scale * SPLIT_GAIN) return split;
  return whole;
};
