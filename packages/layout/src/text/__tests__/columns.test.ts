import { describe, expect, it } from "vitest";

import { span } from "../../template/spans";
import {
  ColumnPlan,
  LineMetrics,
  SPLIT_GAIN,
  solveColumns,
  spansToBlocks,
} from "../columns";

/** `count` lines of the given width, each 10 tall. */
const block = (count: number, width = 100): LineMetrics[] =>
  Array.from({ length: count }, () => ({ width, height: 10 }));

/** The scale a plan actually achieves, recomputed from its columns. */
const achievedScale = (
  plan: ColumnPlan,
  blocks: LineMetrics[][],
  { width, height, columnGap, blockSpacing }: Record<string, number>,
) => {
  let sumWidth = 0;
  let tallest = 0;
  for (const column of plan.columns) {
    let h = 0;
    let w = 0;
    column.forEach((ref, i) => {
      const line = blocks[ref.block]![ref.line]!;
      h += line.height;
      if (i > 0 && column[i - 1]!.block !== ref.block) h += blockSpacing!;
      w = Math.max(w, line.width);
    });
    sumWidth += w;
    tallest = Math.max(tallest, h);
  }
  const available = width! - columnGap! * (plan.columns.length - 1);
  return Math.min(available / sumWidth, height! / tallest);
};

/** Deterministic, so a failure reproduces. */
const rng = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

describe("spansToBlocks", () => {
  it("splits lines on newlines and blocks on blank lines", () => {
    const blocks = spansToBlocks([
      span("Verse 1", "heading"),
      span("\nline a\nline b\n\n\n"),
      span("Chorus", "heading"),
      span("\nline c\n"),
    ]);

    expect(blocks).toEqual([
      [[span("Verse 1", "heading")], [span("line a")], [span("line b")]],
      [[span("Chorus", "heading")], [span("line c")]],
    ]);
  });

  it("keeps a role on both halves of a span cut by a newline", () => {
    expect(spansToBlocks([span("a\nb", "x")])).toEqual([
      [[span("a", "x")], [span("b", "x")]],
    ]);
  });

  it("treats whitespace-only lines as separators", () => {
    expect(spansToBlocks([span("a\n   \nb")])).toHaveLength(2);
  });

  it("returns nothing for empty or blank text", () => {
    expect(spansToBlocks([])).toEqual([]);
    expect(spansToBlocks([span("\n \n")])).toEqual([]);
  });

  it("keeps an annotation on the first half only, even with no text", () => {
    const above = { text: "G", role: "chord" };
    expect(
      spansToBlocks([
        { ...span("a\nb"), above },
        { ...span(""), above },
      ]),
    ).toEqual([
      [[{ ...span("a"), above }], [span("b"), { ...span(""), above }]],
    ]);
  });
});

describe("solveColumns", () => {
  const base = {
    blockSpacing: 10,
    columnGap: 0,
    maxColumns: 4,
  };

  it("uses one column when the text is short and wide", () => {
    const plan = solveColumns({
      ...base,
      blocks: [block(2, 1000)],
      width: 1000,
      height: 1000,
    });

    expect(plan?.columns).toHaveLength(1);
    expect(plan?.scale).toBeCloseTo(1);
  });

  it("spreads tall text across columns to make it larger", () => {
    // Four 4-line blocks in a wide box: one column is height bound at
    // 160 + 3 * 10 = 190 tall, two columns are 90 tall.
    const plan = solveColumns({
      ...base,
      blocks: [block(4), block(4), block(4), block(4)],
      width: 1000,
      height: 100,
    });

    expect(plan!.columns.length).toBeGreaterThan(1);
    expect(plan!.scale).toBeGreaterThan(100 / 190);
  });

  it("never exceeds maxColumns", () => {
    const plan = solveColumns({
      ...base,
      maxColumns: 2,
      blocks: Array.from({ length: 8 }, () => block(4)),
      width: 10000,
      height: 100,
    });

    expect(plan!.columns.length).toBeLessThanOrEqual(2);
  });

  it("keeps the order of the text", () => {
    const plan = solveColumns({
      ...base,
      blocks: [block(3), block(5), block(2), block(4), block(3)],
      width: 2000,
      height: 100,
    });

    const flat = plan!.columns.flat();
    const expected = [3, 5, 2, 4, 3].flatMap((count, b) =>
      Array.from({ length: count }, (_, line) => ({ block: b, line })),
    );
    expect(flat).toEqual(expected);
  });

  it("charges the column gap against the width", () => {
    const blocks = [block(4), block(4)];
    const without = solveColumns({ ...base, blocks, width: 200, height: 40 });
    const withGap = solveColumns({
      ...base,
      columnGap: 100,
      blocks,
      width: 200,
      height: 40,
    });

    expect(withGap!.scale).toBeLessThan(without!.scale);
  });

  it("sizes columns to their own content rather than the widest", () => {
    // A wide block and a narrow one. Equal-width columns would cost 2 * 300;
    // fitted columns cost 300 + 50.
    const plan = solveColumns({
      ...base,
      blocks: [block(4, 300), block(4, 50)],
      width: 350,
      height: 40,
    });

    expect(plan!.columns).toHaveLength(2);
    expect(plan!.scale).toBeCloseTo(1);
  });

  it("keeps blocks whole when that costs little", () => {
    const plan = solveColumns({
      ...base,
      blocks: [block(5), block(4), block(5), block(4)],
      width: 1000,
      height: 100,
    });

    expect(plan!.columns.length).toBeGreaterThan(1);
    for (let b = 0; b < 4; b++) {
      const owners = plan!.columns.filter((c) => c.some((l) => l.block === b));
      expect(owners).toHaveLength(1);
    }
  });

  it("splits one long block when keeping it whole would shrink everything", () => {
    // A single 20-line block can only fill one column unless it is split.
    const blocks = [block(20)];
    const plan = solveColumns({ ...base, blocks, width: 1000, height: 100 });

    expect(plan!.columns.length).toBeGreaterThan(1);
    expect(plan!.scale).toBeGreaterThan((100 / 200) * SPLIT_GAIN);
  });

  it("leaves at least two lines either side of a split", () => {
    const plan = solveColumns({
      ...base,
      blocks: [block(20)],
      width: 1000,
      height: 100,
    });

    for (const column of plan!.columns) {
      expect(column.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("does not split when there is only one column", () => {
    const plan = solveColumns({
      ...base,
      maxColumns: 1,
      blocks: [block(20)],
      width: 1000,
      height: 100,
    });

    expect(plan!.columns).toHaveLength(1);
  });

  it("returns null with nothing to lay out or nowhere to put it", () => {
    expect(
      solveColumns({ ...base, blocks: [], width: 100, height: 100 }),
    ).toBeNull();
    expect(
      solveColumns({ ...base, blocks: [block(2)], width: 0, height: 100 }),
    ).toBeNull();
  });

  it("matches a brute force search over every split", () => {
    const blocks = [block(3, 80), block(6, 120), block(2, 60), block(5, 90)];
    const width = 400;
    const height = 70;
    const plan = solveColumns({ ...base, blocks, width, height });

    // Every way to cut the 4 blocks into 1-4 contiguous columns.
    const heights = blocks.map((b) => b.length * 10);
    const widths = blocks.map((b) => b[0]!.width);
    let best = 0;
    for (let mask = 0; mask < 8; mask++) {
      const groups: number[][] = [[0]];
      for (let i = 1; i < 4; i++) {
        if (mask & (1 << (i - 1))) groups.push([i]);
        else groups[groups.length - 1]!.push(i);
      }
      const sumWidth = groups.reduce(
        (acc, g) => acc + Math.max(...g.map((i) => widths[i]!)),
        0,
      );
      const tallest = Math.max(
        ...groups.map(
          (g) =>
            g.reduce((acc, i) => acc + heights[i]!, 0) + (g.length - 1) * 10,
        ),
      );
      best = Math.max(best, Math.min(width / sumWidth, height / tallest));
    }

    // Splitting may only ever improve on whole blocks.
    expect(plan!.scale).toBeGreaterThanOrEqual(best / 1.01 - 1e-9);
  });

  it("is never beaten by brute force over whole blocks, on random songs", () => {
    const random = rng(42);

    for (let trial = 0; trial < 200; trial++) {
      const count = 1 + Math.floor(random() * 7);
      const blocks = Array.from({ length: count }, () =>
        Array.from({ length: 1 + Math.floor(random() * 8) }, () => ({
          width: 20 + random() * 200,
          height: 8 + random() * 4,
        })),
      );
      const opts = {
        width: 100 + random() * 900,
        height: 50 + random() * 400,
        columnGap: random() * 30,
        blockSpacing: random() * 15,
      };
      const maxColumns = 1 + Math.floor(random() * 4);

      const plan = solveColumns({ ...opts, maxColumns, blocks })!;

      // The reported scale must be one the plan really achieves.
      expect(plan.scale).toBeCloseTo(achievedScale(plan, blocks, opts), 9);
      expect(plan.columns.length).toBeLessThanOrEqual(maxColumns);

      // Every contiguous grouping of whole blocks into <= maxColumns columns.
      let best = 0;
      for (let mask = 0; mask < 1 << (count - 1); mask++) {
        const groups: number[][] = [[0]];
        for (let i = 1; i < count; i++) {
          if (mask & (1 << (i - 1))) groups.push([i]);
          else groups[groups.length - 1]!.push(i);
        }
        if (groups.length > maxColumns) continue;
        const candidate: ColumnPlan = {
          scale: 0,
          columns: groups.map((g) =>
            g.flatMap((b) => blocks[b]!.map((_, line) => ({ block: b, line }))),
          ),
        };
        best = Math.max(best, achievedScale(candidate, blocks, opts));
      }

      // Fewer columns win ties within 1%, so allow exactly that much.
      expect(plan.scale).toBeGreaterThanOrEqual(best / 1.01 - 1e-9);
    }
  });
});
