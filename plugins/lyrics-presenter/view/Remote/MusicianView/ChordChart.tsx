import { type ReactNode, useEffect, useRef } from "react";

import { type SongChart, sectionOfSlide } from "../../../src/musician/chart";
import { FittedChart } from "./FittedChart";
import {
  SECTION_SPACING,
  SectionHeading,
  SlideBlock,
  THEMES,
} from "./chartParts";
import { useAutoColumns } from "./useAutoColumns";
import type { MusicianTheme } from "./useMusicianSettings";

type ChordChartProps = {
  songId: string;
  chart: SongChart;
  /** The live slide, when this is the live song */
  liveIndex: number | null;
  /** Scrolls to the live slide as it moves */
  followLive: boolean;
  showChords: boolean;
  /** px. Ignored when fitting */
  fontSize: number;
  theme: MusicianTheme;
  autoFit: boolean;
  header: ReactNode;
};

export const ChordChart = ({
  songId,
  chart,
  liveIndex,
  followLive,
  showChords,
  fontSize,
  theme,
  autoFit,
  header,
}: ChordChartProps) => {
  const colors = THEMES[theme];
  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);
  const liveSection = sectionOfSlide(chart, liveIndex);
  // Scrolling chart only; nothing to measure when fitting
  const columns = useAutoColumns(scrollerRef, contentRef, [
    chart,
    showChords,
    fontSize,
    autoFit,
  ]);

  // Runs before the effect below, which may scroll down to the live slide
  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: 0 });
  }, [songId]);

  // Not scrollIntoView, which would also scroll the page behind the overlay
  useEffect(() => {
    const scroller = scrollerRef.current;
    const live = liveRef.current;
    if (!followLive || !scroller || !live) return;
    const target =
      live.offsetTop - scroller.clientHeight / 3 + live.offsetHeight / 2;
    scroller.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
  }, [followLive, liveIndex, chart, columns, autoFit]);

  return (
    <div
      ref={scrollerRef}
      data-testid="ly-musician-chart"
      data-fit={autoFit}
      className="relative min-h-0 flex-1 overflow-auto px-4 py-4 sm:px-8"
    >
      {autoFit ? (
        <FittedChart
          chart={chart}
          liveIndex={liveIndex}
          showChords={showChords}
          colors={colors}
          liveRef={liveRef}
          header={header}
        />
      ) : (
        <div
          ref={contentRef}
          data-testid="ly-musician-columns"
          data-columns={columns}
          className="mx-auto"
          style={{ fontSize }}
        >
          <div className="pb-3" style={{ columnSpan: "all" }}>
            {header}
          </div>
          {chart.sections.map((section, s) => (
            <section key={s} style={{ marginBottom: `${SECTION_SPACING}em` }}>
              <SectionHeading
                heading={section.heading}
                colors={colors}
                isLive={s === liveSection}
              />
              {section.slides.map((slide) => {
                const isLive = slide.index === liveIndex;
                return (
                  <SlideBlock
                    key={slide.index}
                    ref={isLive ? liveRef : undefined}
                    slide={slide}
                    colors={colors}
                    isLive={isLive}
                    showChords={showChords}
                  />
                );
              })}
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
