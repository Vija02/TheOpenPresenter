import { FrameData, Span, span } from "@repo/layout";

import { hasInlineChords, tokenizeChordPro } from "../chords/chordpro";
import { GroupedData } from "../processLyrics";
import type { Song } from "../types";
import {
  CHORD_ROLE,
  HEADING_ROLE,
  LIVE_CHORD_ROLE,
  LIVE_HEADING_ROLE,
  LIVE_ROLE,
} from "./ids";

type SongInfo = Pick<Song, "title" | "author">;

/** The section and lines at a flat slide index */
export const slideAt = (
  groups: GroupedData,
  index: number,
): { heading: string; lines: string[] } | null => {
  let counter = 0;
  for (const group of groups) {
    if (index < counter + group.slides.length) {
      return {
        heading: group.heading,
        lines: group.slides[index - counter] ?? [],
      };
    }
    counter += group.slides.length;
  }
  return null;
};

const withChord = (text: string, chord: string, role: string | null): Span => ({
  ...span(text, role),
  above: {
    text: chord,
    role: role === LIVE_ROLE ? LIVE_CHORD_ROLE : CHORD_ROLE,
  },
});

/** Plain text runs together, so a slide without chords is one span */
const append = (out: Span[], next: Span) => {
  const last = out[out.length - 1];
  if (last && !last.above && !next.above && last.role === next.role) {
    out[out.length - 1] = { ...last, text: last.text + next.text };
  } else {
    out.push(next);
  }
};

/** Lines, each inline chord over the text after it, on from what's in `out` */
const appendLines = (out: Span[], lines: string[], role: string | null) => {
  for (const line of lines) {
    if (out.length > 0) append(out, span("\n"));
    if (!hasInlineChords(line)) {
      append(out, span(line, role));
      continue;
    }

    let chord: string | null = null;
    for (const token of tokenizeChordPro(line)) {
      if (token.type === "chord") {
        // Two chords in a row: the first is over nothing
        if (chord !== null) append(out, withChord("", chord, role));
        chord = token.value;
      } else {
        append(
          out,
          chord === null
            ? span(token.value, role)
            : withChord(token.value, chord, role),
        );
        chord = null;
      }
    }
    if (chord !== null) append(out, withChord("", chord, role));
  }
};

const slideSpans = (lines: string[]): Span[] => {
  const out: Span[] = [];
  appendLines(out, lines, null);
  return out;
};

const songInfo = (song: SongInfo) => ({
  title: song.title,
  author: song.author ?? "",
});

/** One slide of a song shown in sections */
export const sectionsFrame = (
  song: SongInfo,
  groups: GroupedData,
  index: number,
): FrameData => {
  const slide = slideAt(groups, index);
  return {
    ...songInfo(song),
    lyrics: slideSpans(slide?.lines ?? []),
    section: slide?.heading ?? "",
  };
};

/**
 * The whole song. Each section is a block led by its heading, which the
 * `columns` fit keeps together where it can
 */
export const fullSongFrame = (
  song: SongInfo,
  groups: GroupedData,
  /** The flat index of a slide to pick out, as the live one */
  highlight: number | null = null,
): FrameData => {
  const spans: Span[] = [];
  let index = 0;
  groups.forEach((group, i) => {
    if (i > 0) spans.push(span("\n\n"));
    const isLive =
      highlight !== null &&
      highlight >= index &&
      highlight < index + group.slides.length;
    append(
      spans,
      span(group.heading, isLive ? LIVE_HEADING_ROLE : HEADING_ROLE),
    );
    for (const lines of group.slides) {
      appendLines(spans, lines, index === highlight ? LIVE_ROLE : null);
      index += 1;
    }
  });

  return { ...songInfo(song), lyrics: spans, section: "" };
};
