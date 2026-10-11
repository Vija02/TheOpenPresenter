import { cx } from "class-variance-authority";
import { type CSSProperties, type Ref } from "react";

import type { ChordSegment } from "../../../src/chords/chordpro";
import type { ChartSlide as ChartSlideData } from "../../../src/musician/chart";
import type { MusicianTheme } from "./useMusicianSettings";

/** Dark matches the landing page's musician tablet */
export const THEMES = {
  dark: {
    chart: "bg-black text-gray-200",
    chord: "text-[#f5b547]",
    heading: "text-gray-400",
    liveHeading: "text-[#f5b547]",
    liveSlide: "border-[#f5b547] bg-[#f5b547]/10",
  },
  light: {
    chart: "bg-surface-primary text-primary",
    chord: "text-accent",
    heading: "text-secondary",
    liveHeading: "text-fill-warning",
    liveSlide: "border-fill-warning bg-fill-warning/10",
  },
} satisfies Record<MusicianTheme, Record<string, string>>;

export type ChartColors = (typeof THEMES)[MusicianTheme];

/** em */
export const SECTION_SPACING = 1.2;

/** Each chord over the start of its text, the text on the line's baseline */
const ChartLine = ({
  segments,
  showChords,
  chordClassName,
  noWrap,
  measuring,
}: {
  segments: ChordSegment[];
  showChords: boolean;
  chordClassName: string;
  noWrap: boolean;
  measuring: boolean;
}) => {
  const withChords = showChords && segments.some((s) => s.chord !== null);

  return (
    <div
      className={cx(
        "leading-snug",
        noWrap ? "whitespace-pre" : "whitespace-pre-wrap",
      )}
    >
      {segments.map((segment, i) =>
        withChords && segment.chord !== null ? (
          <span
            key={i}
            className={cx(
              "inline-block align-baseline",
              !noWrap && "max-w-full",
            )}
          >
            <span
              data-testid={measuring ? undefined : "ly-musician-chord"}
              className={cx(
                "block pr-[0.4em] text-[0.85em] font-bold leading-tight",
                chordClassName,
              )}
            >
              {segment.chord}
            </span>
            {/* A zero-width space keeps the lyric row's height */}
            <span className="block">{segment.text || "​"}</span>
          </span>
        ) : (
          <span key={i}>{segment.text}</span>
        ),
      )}
    </div>
  );
};

/** With chords hidden, a line of only chords has nothing left to show */
const isChordOnly = (segments: ChordSegment[]) =>
  segments.every((s) => s.text.trim() === "") &&
  segments.some((s) => s.chord !== null);

type PartProps = {
  colors: ChartColors;
  isLive: boolean;
  /** Off-screen copies carry no test ids */
  measuring?: boolean;
  style?: CSSProperties;
};

export const SectionHeading = ({
  heading,
  colors,
  isLive,
  measuring,
  style,
}: PartProps & { heading: string }) => (
  <h3
    data-testid={measuring ? undefined : "ly-musician-heading"}
    data-live={isLive}
    style={style}
    className={cx(
      "mb-[0.2em] break-after-avoid text-[0.7em] font-semibold uppercase tracking-wide",
      isLive ? colors.liveHeading : colors.heading,
    )}
  >
    {heading}
  </h3>
);

export const SlideBlock = ({
  slide,
  colors,
  isLive,
  measuring,
  style,
  showChords,
  noWrap = false,
  ref,
}: PartProps & {
  slide: ChartSlideData;
  showChords: boolean;
  /** For the fitted chart, whose measured widths assume unwrapped lines */
  noWrap?: boolean;
  ref?: Ref<HTMLDivElement>;
}) => (
  <div
    ref={ref}
    data-testid={measuring ? undefined : "ly-musician-slide"}
    data-live={isLive}
    style={style}
    className={cx(
      "-ml-3 mb-[0.4em] break-inside-avoid rounded-r border-l-4 py-[0.15em] pl-2",
      isLive ? colors.liveSlide : "border-transparent",
    )}
  >
    {slide.lines
      .filter((line) => showChords || !isChordOnly(line))
      .map((line, i) => (
        <ChartLine
          key={i}
          segments={line}
          showChords={showChords}
          chordClassName={colors.chord}
          noWrap={noWrap}
          measuring={!!measuring}
        />
      ))}
  </div>
);
