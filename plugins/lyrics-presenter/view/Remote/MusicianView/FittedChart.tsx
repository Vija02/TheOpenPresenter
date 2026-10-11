import { type LineMetrics, type LineRef, solveColumns } from "@repo/layout";
import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { type SongChart, sectionOfSlide } from "../../../src/musician/chart";
import {
  type ChartColors,
  SECTION_SPACING,
  SectionHeading,
  SlideBlock,
} from "./chartParts";

/** px. Large, so measuring rounding is negligible once scaled */
const REFERENCE_SIZE = 40;
/** px */
const MAX_FONT_SIZE = 72;
/** px. Below this it scrolls instead */
const MIN_FONT_SIZE = 10;
/** px */
const COLUMN_GAP = 40;
const MAX_COLUMNS = 4;
const VERIFY_PASSES = 4;

/** Room for the live slide's bar */
const ITEM_STYLE: CSSProperties = { paddingLeft: "0.75rem" };

type Fit = {
  /** px */
  fontSize: number;
  /** Blocks are sections: line 0 is the heading, then one per slide */
  columns: LineRef[][];
  passes: number;
  /** The refs index into this chart */
  chart: SongChart;
};

type FittedChartProps = {
  chart: SongChart;
  liveIndex: number | null;
  showChords: boolean;
  colors: ChartColors;
  liveRef: RefObject<HTMLDivElement | null>;
  /** The song is fitted into the space under it */
  header: ReactNode;
};

const clampFontSize = (size: number) =>
  Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.floor(size * 4) / 4));

/**
 * The whole song at the largest size that fits
 */
export const FittedChart = ({
  chart,
  liveIndex,
  showChords,
  colors,
  liveRef,
  header,
}: FittedChartProps) => {
  // Its own box: a parent's ref isn't attached yet on the first layout
  const boxRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [fit, setFit] = useState<Fit | null>(null);
  const liveSection = sectionOfSlide(chart, liveIndex);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const headerBox = headerRef.current;
    if (!box || !headerBox) return;
    const measure = () =>
      setSize({
        width: box.clientWidth,
        height: box.clientHeight - headerBox.offsetHeight,
      });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(headerBox);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const root = measureRef.current;
    if (!root || !size) return;

    const blocks: LineMetrics[][] = chart.sections.map(() => []);
    root.querySelectorAll<HTMLElement>("[data-ref]").forEach((el) => {
      const [block, line] = el.dataset.ref!.split(":").map(Number);
      const rect = el.getBoundingClientRect();
      blocks[block!]![line!] = { width: rect.width, height: rect.height };
    });

    const plan = solveColumns({
      blocks,
      blockSpacing: SECTION_SPACING * REFERENCE_SIZE,
      width: size.width,
      height: size.height,
      columnGap: COLUMN_GAP,
      maxColumns: MAX_COLUMNS,
    });
    setFit(
      plan && {
        fontSize: clampFontSize(REFERENCE_SIZE * plan.scale),
        columns: plan.columns,
        passes: 0,
        chart,
      },
    );
  }, [chart, showChords, size]);

  // Fixed px (bar room, gap) and glyph widths don't scale exactly
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row || !fit || !size) return;
    if (fit.passes >= VERIFY_PASSES || fit.fontSize <= MIN_FONT_SIZE) return;
    const { width, height } = row.getBoundingClientRect();
    if (width <= size.width + 0.5 && height <= size.height + 0.5) return;
    const ratio = Math.min(size.width / width, size.height / height);
    setFit({
      ...fit,
      fontSize: clampFontSize(
        Math.min(fit.fontSize - 0.25, fit.fontSize * ratio * 0.995),
      ),
      passes: fit.passes + 1,
    });
  }, [fit, size]);

  const renderItem = (
    { block, line }: LineRef,
    {
      measuring = false,
      style,
    }: { measuring?: boolean; style?: CSSProperties },
  ) => {
    const section = chart.sections[block]!;
    if (line === 0) {
      return (
        <SectionHeading
          heading={section.heading}
          colors={colors}
          isLive={!measuring && block === liveSection}
          measuring={measuring}
          style={style}
        />
      );
    }
    const slide = section.slides[line - 1]!;
    const isLive = !measuring && slide.index === liveIndex;
    return (
      <SlideBlock
        ref={isLive ? liveRef : undefined}
        slide={slide}
        colors={colors}
        isLive={isLive}
        measuring={measuring}
        showChords={showChords}
        noWrap
        style={style}
      />
    );
  };

  return (
    <div ref={boxRef} className="h-full">
      {/* Measured for solveColumns */}
      <div
        aria-hidden
        className="pointer-events-none invisible absolute left-0 top-0 h-0 w-0 overflow-hidden"
      >
        <div
          ref={measureRef}
          className="w-max"
          style={{ fontSize: REFERENCE_SIZE }}
        >
          {chart.sections.map((section, block) =>
            [null, ...section.slides].map((_, line) => (
              // flow-root keeps the item's margins in what's measured
              <div
                key={`${block}:${line}`}
                data-ref={`${block}:${line}`}
                className="flow-root w-max"
                style={ITEM_STYLE}
              >
                {renderItem({ block, line }, { measuring: true })}
              </div>
            )),
          )}
        </div>
      </div>

      <div className="mx-auto w-max max-w-full">
        {/* Padding, not margin, so offsetHeight includes it */}
        <div ref={headerRef} className="pb-3" style={ITEM_STYLE}>
          {header}
        </div>
        {/* A new song renders once before it's solved for */}
        {fit && fit.chart === chart && (
          <div
            ref={rowRef}
            data-testid="ly-musician-columns"
            data-columns={fit.columns.length}
            data-font-size={fit.fontSize}
            className="flex w-max items-start"
            style={{ fontSize: fit.fontSize, columnGap: COLUMN_GAP }}
          >
            {fit.columns.map((column, c) => (
              <div key={c} className="flex flex-col">
                {column.map((ref, i) => {
                  const startsBlock =
                    i > 0 && column[i - 1]!.block !== ref.block;
                  return (
                    <div
                      key={`${ref.block}:${ref.line}`}
                      className="flow-root"
                      style={{
                        ...ITEM_STYLE,
                        marginTop: startsBlock
                          ? `${SECTION_SPACING}em`
                          : undefined,
                      }}
                    >
                      {renderItem(ref, {})}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
