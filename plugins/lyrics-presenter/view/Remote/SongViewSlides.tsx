import { Slide } from "@repo/ui";
import { useMemo } from "react";

import { SlideStyle, Song } from "../../src";
import { GroupedData } from "../../src/processLyrics";
import { getSlideStyle } from "../../src/slideStyle";
import { processSong } from "../../src/songHelpers";
import FullSongRenderView from "../Renderer/FullSongRenderView";
import SectionsRenderView from "../Renderer/SectionsRenderView";
import { usePluginAPI } from "../pluginApi";

export const SongViewSlides = ({
  song,
  isPreview = false,
  slideStyle,
}: {
  song: Song;
  isPreview?: boolean;
  slideStyle: SlideStyle;
}) => {
  const groupedData = useMemo(() => processSong(song.content), [song.content]);

  if (song.setting.displayType === "sections") {
    return (
      <Sections
        song={song}
        groupedData={groupedData}
        isPreview={isPreview}
        slideStyle={slideStyle}
      />
    );
  } else if (song.setting.displayType === "fullSong") {
    return (
      <FullSong
        song={song}
        groupedData={groupedData}
        isPreview={isPreview}
        slideStyle={slideStyle}
      />
    );
  }
};

const Sections = ({
  song,
  groupedData,
  slideStyle,
  isPreview = false,
}: {
  song: Song;
  groupedData: GroupedData;
  slideStyle: SlideStyle;
  isPreview?: boolean;
}) => {
  const pluginApi = usePluginAPI();
  const mutableRendererData = pluginApi.renderer.useValtioData();
  const setRenderCurrentScene = pluginApi.renderer.setRenderCurrentScene;

  const renderData = pluginApi.renderer.useData((x) => x);

  return (
    <>
      {groupedData.map(({ heading, slides }, i, all) => {
        const previousCounts = all
          .slice(0, i)
          .map((x) => x.slides.length)
          .reduce((acc, val) => acc + val, 0);

        return slides.map((_, j) => {
          const currentIndex = previousCounts + j;

          return (
            <Slide
              key={`${i}_${j}`}
              heading={j !== 0 ? heading + " (cont.)" : heading}
              headingIsFaded={j !== 0}
              isActive={
                !isPreview &&
                currentIndex === renderData.currentIndex &&
                song.id === renderData.songId
              }
              onClick={
                isPreview
                  ? undefined
                  : () => {
                      mutableRendererData.currentIndex = currentIndex;
                      mutableRendererData.songId = song.id;
                      setRenderCurrentScene();
                    }
              }
            >
              <SectionsRenderView
                groupedData={groupedData}
                currentIndex={currentIndex}
                slideStyle={getSlideStyle(slideStyle)}
              />
            </Slide>
          );
        });
      })}
    </>
  );
};
const FullSong = ({
  song,
  groupedData,
  slideStyle,
  isPreview = false,
}: {
  song: Song;
  groupedData: GroupedData;
  slideStyle: SlideStyle;
  isPreview?: boolean;
}) => {
  const pluginApi = usePluginAPI();
  const mutableRendererData = pluginApi.renderer.useValtioData();
  const setRenderCurrentScene = pluginApi.renderer.setRenderCurrentScene;

  const activeSongId = pluginApi.renderer.useData((x) => x.songId);

  return (
    <Slide
      isActive={!isPreview && song.id === activeSongId}
      onClick={
        isPreview
          ? undefined
          : () => {
              if (!isPreview) {
                mutableRendererData.songId = song.id;
                setRenderCurrentScene();
              }
            }
      }
    >
      <FullSongRenderView
        groupedData={groupedData}
        slideStyle={getSlideStyle(slideStyle)}
      />
    </Slide>
  );
};
