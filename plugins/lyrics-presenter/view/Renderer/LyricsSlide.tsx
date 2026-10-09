import type { LayoutDoc } from "@repo/layout";
import { LayoutRenderer } from "@repo/layout/react";
import React, { useMemo } from "react";

import { Background } from "../../src/backgrounds";
import { processSong } from "../../src/songHelpers";
import {
  composeLayout,
  fullSongLayout,
  withLiveRole,
} from "../../src/template/layout";
import {
  fullSongFrame,
  sectionsFrame,
  slideAt,
} from "../../src/template/toFrame";
import { Song } from "../../src/types";

type LyricsSlideProps = {
  song: Song;
  template: LayoutDoc;
  index: number | null;
  background?: Background | null;
  showChords?: boolean;
  fullSong?: boolean;
  /** In a full song, the flat index of the slide to pick out as live */
  highlight?: number | null;
};

export const LyricsSlide = React.memo(
  ({
    song,
    template,
    index,
    background = null,
    showChords = false,
    fullSong,
    highlight = null,
  }: LyricsSlideProps) => {
    const { title, author, content } = song;
    const sectionOrder = song.setting.sectionOrder;
    const isFullSong = fullSong ?? song.setting.displayType === "fullSong";
    const isHighlighted = isFullSong && highlight !== null;

    const groups = useMemo(
      () => processSong(content, sectionOrder, { chords: showChords }),
      [content, sectionOrder, showChords],
    );

    const doc = useMemo(() => {
      const text = isFullSong ? fullSongLayout(template) : template;
      return composeLayout(
        isHighlighted ? withLiveRole(text) : text,
        background,
      );
    }, [template, isFullSong, isHighlighted, background]);

    const data = useMemo(() => {
      if (isFullSong) {
        return fullSongFrame({ title, author }, groups, highlight);
      }
      if (index === null || slideAt(groups, index) === null) return null;
      return sectionsFrame({ title, author }, groups, index);
    }, [isFullSong, groups, index, title, author, highlight]);

    if (!data) return null;

    return <LayoutRenderer doc={doc} data={data} scope="lyrics" />;
  },
);
