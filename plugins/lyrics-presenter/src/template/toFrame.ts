import { FrameData, Span, span } from "@repo/layout";

import { GroupedData } from "../processLyrics";
import type { Song } from "../types";
import { HEADING_ROLE } from "./ids";

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
    lyrics: [span(slide?.lines.join("\n") ?? "")],
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
): FrameData => {
  const spans: Span[] = [];
  groups.forEach((group, i) => {
    if (i > 0) spans.push(span("\n\n"));
    spans.push(span(group.heading, HEADING_ROLE));
    const lines = group.slides.flat();
    if (lines.length > 0) spans.push(span("\n" + lines.join("\n")));
  });

  return { ...songInfo(song), lyrics: spans, section: "" };
};
