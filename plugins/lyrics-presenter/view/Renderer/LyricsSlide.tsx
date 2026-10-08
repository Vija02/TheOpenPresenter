import type { LayoutDoc } from "@repo/layout";
import { LayoutRenderer } from "@repo/layout/react";
import React, { useMemo } from "react";

import { Background } from "../../src/backgrounds";
import { processSong } from "../../src/songHelpers";
import { composeLayout, fullSongLayout } from "../../src/template/layout";
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
};

export const LyricsSlide = React.memo(
  ({ song, template, index, background = null }: LyricsSlideProps) => {
    const { title, author, content } = song;
    const sectionOrder = song.setting.sectionOrder;
    const isFullSong = song.setting.displayType === "fullSong";

    const groups = useMemo(
      () => processSong(content, sectionOrder),
      [content, sectionOrder],
    );

    const doc = useMemo(
      () =>
        composeLayout(
          isFullSong ? fullSongLayout(template) : template,
          background,
        ),
      [template, isFullSong, background],
    );

    const data = useMemo(() => {
      if (isFullSong) return fullSongFrame({ title, author }, groups);
      if (index === null || slideAt(groups, index) === null) return null;
      return sectionsFrame({ title, author }, groups, index);
    }, [isFullSong, groups, index, title, author]);

    if (!data) return null;

    return <LayoutRenderer doc={doc} data={data} scope="lyrics" />;
  },
);
