import { hash } from "ohash";
import { CSSProperties } from "react";

import { SpanRoleStyle, TextTransform } from "../../schema/style";
import { LineRef, TextBlock, solveColumns } from "../../text/columns";
import { getFontGeneration } from "./fontStatus";
import { spansToHtml } from "./measure";

/**
 * The structure below is shared by the measure node and `TextElementView`, so
 * what is measured is what is drawn. Columns only differ in `flex`: natural
 * width when measuring, and growing into the slack when rendered.
 */
export const columnRowStyle = (columnGap: number): CSSProperties => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "flex-start",
  columnGap: `${columnGap}px`,
});

/** One blank line between blocks, in `em` so it scales with the text. */
export const blockStartStyle = (lineHeight: number): CSSProperties => ({
  marginTop: `${lineHeight}em`,
});

export const startsBlock = (column: LineRef[], index: number): boolean =>
  index > 0 && column[index - 1]!.block !== column[index]!.block;

export type ColumnFitSpec = {
  blocks: TextBlock[];
  roles: Record<string, SpanRoleStyle> | null;
  /** px */
  width: number;
  height: number;
  fontFamily: string;
  fontWeight: number;
  fontStyle: string;
  lineHeight: number;
  /** px */
  letterSpacing: number;
  textTransform: TextTransform;
  /** px */
  columnGap: number;
  maxColumns: number;
};

export type ColumnFit = {
  /** px */
  fontSize: number;
  columns: LineRef[][];
};

/** Large, so sub-pixel rounding in the measurement is negligible once scaled. */
const REFERENCE_SIZE = 100;
const MIN_FONT_SIZE = 1;
/** Rounds of shrink-and-check against the real layout. */
const VERIFY_PASSES = 4;

const roundDown = (size: number) =>
  Math.max(MIN_FONT_SIZE, Math.floor(size * 4) / 4);

const singleColumn = (blocks: TextBlock[]): LineRef[][] => {
  const lines = blocks.flatMap((block, b) =>
    block.map((_, line) => ({ block: b, line })),
  );
  return lines.length > 0 ? [lines] : [];
};

let measureNode: HTMLDivElement | null = null;

const getMeasureNode = (): HTMLDivElement => {
  if (measureNode) return measureNode;
  const el = document.createElement("div");
  Object.assign(el.style, {
    position: "absolute",
    visibility: "hidden",
    pointerEvents: "none",
    left: "-99999px",
    top: "0",
    margin: "0",
    padding: "0",
    width: "max-content",
    whiteSpace: "pre",
  } as Partial<CSSStyleDeclaration>);
  document.body.appendChild(el);
  measureNode = el;
  return el;
};

const lineNode = (
  blocks: TextBlock[],
  roles: ColumnFitSpec["roles"],
  { block, line }: LineRef,
): HTMLDivElement => {
  const el = document.createElement("div");
  el.innerHTML = spansToHtml(blocks[block]![line]!, roles);
  return el;
};

const CACHE_LIMIT = 200;
const cache = new Map<string, ColumnFit>();

const remember = (key: string, value: ColumnFit): ColumnFit => {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
  return value;
};

/**
 * Font size and column split for the `columns` fit mode.
 *
 * Every line is measured once, at a reference size, and `solveColumns` picks
 * the split from those numbers alone. The result is then laid out for real and
 * shrunk if it overflows: letter spacing is fixed px and so does not scale with
 * the text, and glyph widths are not perfectly linear across sizes either.
 *
 * Synchronous and cached, like `fitFontSize`.
 */
export const fitColumns = (spec: ColumnFitSpec): ColumnFit => {
  const fallback: ColumnFit = {
    fontSize: MIN_FONT_SIZE,
    columns: singleColumn(spec.blocks),
  };
  if (typeof document === "undefined") return fallback;
  if (spec.width <= 0 || spec.height <= 0 || spec.blocks.length === 0) {
    return fallback;
  }

  const key = hash({ spec, fonts: getFontGeneration() });
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const root = getMeasureNode();
  Object.assign(root.style, {
    fontFamily: spec.fontFamily,
    fontWeight: String(spec.fontWeight),
    fontStyle: spec.fontStyle,
    lineHeight: String(spec.lineHeight),
    letterSpacing: `${spec.letterSpacing}px`,
    textTransform: spec.textTransform,
    fontSize: `${REFERENCE_SIZE}px`,
  } as Partial<CSSStyleDeclaration>);

  // --- every line, once, at the reference size ----------------------------
  const lineNodes = spec.blocks.map((block, b) =>
    block.map((_, line) => {
      const el = lineNode(spec.blocks, spec.roles, { block: b, line });
      el.style.width = "max-content";
      return el;
    }),
  );
  root.replaceChildren(...lineNodes.flat());

  const metrics = lineNodes.map((nodes) =>
    nodes.map((el) => {
      const rect = el.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    }),
  );

  const plan = solveColumns({
    blocks: metrics,
    blockSpacing: spec.lineHeight * REFERENCE_SIZE,
    width: spec.width,
    height: spec.height,
    columnGap: spec.columnGap,
    maxColumns: spec.maxColumns,
  });
  if (!plan) {
    root.replaceChildren();
    return remember(key, fallback);
  }

  // --- the chosen split, laid out for real --------------------------------
  const row = document.createElement("div");
  Object.assign(row.style, columnRowStyle(spec.columnGap), {
    width: "max-content",
  });
  for (const column of plan.columns) {
    const col = document.createElement("div");
    col.style.flex = "0 0 auto";
    column.forEach((ref, i) => {
      const el = lineNode(spec.blocks, spec.roles, ref);
      if (startsBlock(column, i)) {
        Object.assign(el.style, blockStartStyle(spec.lineHeight));
      }
      col.appendChild(el);
    });
    row.appendChild(col);
  }
  root.replaceChildren(row);

  let fontSize = roundDown(REFERENCE_SIZE * plan.scale);
  for (let pass = 0; pass < VERIFY_PASSES; pass++) {
    root.style.fontSize = `${fontSize}px`;
    const { width, height } = row.getBoundingClientRect();
    // Half a pixel of tolerance, as in fitFontSize.
    if (width <= spec.width + 0.5 && height <= spec.height + 0.5) break;
    if (fontSize <= MIN_FONT_SIZE) break;
    const ratio = Math.min(spec.width / width, spec.height / height);
    fontSize = roundDown(Math.min(fontSize - 0.25, fontSize * ratio * 0.995));
  }

  root.replaceChildren();
  return remember(key, { fontSize, columns: plan.columns });
};
