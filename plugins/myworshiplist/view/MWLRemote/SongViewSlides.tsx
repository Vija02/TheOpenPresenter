import { Slide } from "@repo/ui";
import { useMemo } from "react";

import { Song } from "../../src";
import { getSlideStyle } from "../../src/slideStyle";
import MWLFullSongRenderView from "../MWLRenderer/MWLFullSongRenderView";
import MWLSectionsRenderView from "../MWLRenderer/MWLSectionsRenderView";
import { usePluginAPI } from "../pluginApi";
import { processSongCache } from "../songHelpers";

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
  groupedData: Record<string, string[]>;
  isPreview?: boolean;
}) => {
  const pluginApi = usePluginAPI();
  const mutableRendererData = pluginApi.renderer.useValtioData();
  const setRenderCurrentScene = pluginApi.renderer.setRenderCurrentScene;

  const slideStyle = pluginApi.scene.useData((x) => x.pluginData.style);
  const renderData = pluginApi.renderer.useData((x) => x);

  return (
    <>
      {Object.keys(groupedData).map((section, i) => (
        <Slide
          key={i}
          heading={section}
          isActive={
            !isPreview &&
            section === renderData.heading &&
            song.id === renderData.songId
          }
          onClick={
            isPreview
              ? undefined
              : () => {
                  mutableRendererData.heading = section;
                  mutableRendererData.songId = song.id;
                  setRenderCurrentScene();
                }
          }
        >
          <MWLSectionsRenderView
            groupedData={groupedData}
            heading={section}
            slideStyle={getSlideStyle(slideStyle)}
          />
        </Slide>
      ))}
    </>
  );
};
const FullSong = ({
  song,
  groupedData,
  isPreview = false,
}: {
  song: Song;
  groupedData: Record<string, string[]>;
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
      <MWLFullSongRenderView
        groupedData={groupedData}
        slideStyle={getSlideStyle(slideStyle)}
      />
    </Slide>
  );
};
