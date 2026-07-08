import { Slide } from "@repo/ui";
import { InternalVideo } from "@repo/video";
import { Fragment, useMemo } from "react";

import { GroupedData } from "../../src/processLyrics";
import { getSlideStyle } from "../../src/slideStyle";
import { processSong } from "../../src/songHelpers";
import { SlideStyle, Song } from "../../src/types";
import FullSongRenderView from "../Renderer/FullSongRenderView";
import SectionsRenderView from "../Renderer/SectionsRenderView";
import { PreviewVideoBackgroundsContext } from "../Renderer/useVideoBackgroundThumbnail";
import { usePluginAPI } from "../pluginApi";

export const SongViewSlides = ({
  song,
  isPreview = false,
  slideStyle,
  videoBackgrounds,
}: {
  song: Song;
  isPreview?: boolean;
  slideStyle: SlideStyle;
  // Pass this to handle previewing without it being in the data itself
  videoBackgrounds?: InternalVideo[];
}) => {
  const groupedData = useMemo(
    () => processSong(song.content, song.setting.sectionOrder),
    [song.content, song.setting.sectionOrder],
  );

  const content =
    song.setting.displayType === "sections" ? (
      <Sections
        song={song}
        groupedData={groupedData}
        isPreview={isPreview}
        slideStyle={slideStyle}
      />
    ) : song.setting.displayType === "fullSong" ? (
      <FullSong
        song={song}
        groupedData={groupedData}
        isPreview={isPreview}
        slideStyle={slideStyle}
      />
    ) : null;

  // Only override for previews that actually pass saved video backgrounds
  if (isPreview && videoBackgrounds) {
    return (
      <PreviewVideoBackgroundsContext.Provider value={videoBackgrounds}>
        {content}
      </PreviewVideoBackgroundsContext.Provider>
    );
  }
  return <Fragment>{content}</Fragment>;
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
              pluginAPI={pluginApi}
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
                renderVideoThumbnail
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
      pluginAPI={pluginApi}
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
        renderVideoThumbnail
      />
    </Slide>
  );
};
