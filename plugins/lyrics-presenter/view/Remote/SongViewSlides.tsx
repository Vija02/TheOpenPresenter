import { Slide } from "@repo/ui";
import { useMemo } from "react";

import { Song } from "../../src";
import { getSlideStyle } from "../../src/slideStyle";
import FullSongRenderView from "../Renderer/FullSongRenderView";
import SectionsRenderView from "../Renderer/SectionsRenderView";
import { usePluginAPI } from "../pluginApi";
import { GroupedData, processSongCache } from "../songHelpers";

export const SongViewSlides = ({
  song,
  isPreview = false,
}: {
  song: Song;
  isPreview?: boolean;
}) => {
  const groupedData = useMemo(() => processSongCache(song), [song]);

  if (song.setting.displayType === "sections") {
    return (
      <Sections song={song} groupedData={groupedData} isPreview={isPreview} />
    );
  } else if (song.setting.displayType === "fullSong") {
    return (
      <FullSong song={song} groupedData={groupedData} isPreview={isPreview} />
    );
  }
};

const Sections = ({
  song,
  groupedData,
  isPreview = false,
}: {
  song: Song;
  groupedData: GroupedData;
  isPreview?: boolean;
}) => {
  const pluginApi = usePluginAPI();
  const mutableRendererData = pluginApi.renderer.useValtioData();
  const setRenderCurrentScene = pluginApi.renderer.setRenderCurrentScene;

  const slideStyle = pluginApi.scene.useData((x) => x.pluginData.style);
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
  isPreview = false,
}: {
  song: Song;
  groupedData: GroupedData;
  isPreview?: boolean;
}) => {
  const pluginApi = usePluginAPI();
  const mutableRendererData = pluginApi.renderer.useValtioData();
  const setRenderCurrentScene = pluginApi.renderer.setRenderCurrentScene;

  const slideStyle = pluginApi.scene.useData((x) => x.pluginData.style);
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
