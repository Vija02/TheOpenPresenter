import type { LayoutDoc } from "@repo/layout";
import { Slide } from "@repo/ui";
import { useMemo } from "react";

import {
  ResolvedBackground,
  resolveSongBackground,
} from "../../src/backgrounds";
import { GroupedData } from "../../src/processLyrics";
import { processSong } from "../../src/songHelpers";
import { sceneBackground, songTemplate } from "../../src/template/layout";
import { Song } from "../../src/types";
import { LyricsSlide } from "../Renderer/LyricsSlide";
import { usePluginAPI } from "../pluginApi";
import { useActivateLyricSlide } from "../useActivateLyricSlide";

export const SongViewSlides = ({
  song,
  isPreview = false,
}: {
  song: Song;
  isPreview?: boolean;
}) => {
  const pluginApi = usePluginAPI();
  const template = pluginApi.scene.useData((x) => x.pluginData.template);
  const background = pluginApi.scene.useData((x) => x.pluginData.background);

  const groupedData = useMemo(
    () => processSong(song.content, song.setting.sectionOrder),
    [song.content, song.setting.sectionOrder],
  );

  // The same resolvers as the output
  const resolvedTemplate = songTemplate(song, { template });
  const resolvedBackground = useMemo(
    () => resolveSongBackground(song, sceneBackground({ background })),
    [song, background],
  );

  const props = {
    song,
    groupedData,
    isPreview,
    template: resolvedTemplate,
    background: resolvedBackground,
  };

  return song.setting.displayType === "sections" ? (
    <Sections {...props} />
  ) : song.setting.displayType === "fullSong" ? (
    <FullSong {...props} />
  ) : null;
};

type SlidesProps = {
  song: Song;
  groupedData: GroupedData;
  template: LayoutDoc;
  /** The same for every slide of the song */
  background: ResolvedBackground;
  isPreview?: boolean;
};

const Sections = ({
  song,
  groupedData,
  template,
  background,
  isPreview = false,
}: SlidesProps) => {
  const pluginApi = usePluginAPI();
  const { activate } = useActivateLyricSlide();
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
                      activate(song.id, currentIndex);
                      setRenderCurrentScene();
                    }
              }
            >
              <div
                className="contents"
                data-testid="lyrics-slide-background"
                data-background-key={background?.key ?? ""}
              >
                <LyricsSlide
                  song={song}
                  template={template}
                  index={currentIndex}
                  background={background?.background}
                />
              </div>
            </Slide>
          );
        });
      })}
    </>
  );
};
const FullSong = ({
  song,
  template,
  background,
  isPreview = false,
}: SlidesProps) => {
  const pluginApi = usePluginAPI();
  const mutableRendererData = pluginApi.renderer.useValtioData();
  const { activate } = useActivateLyricSlide();
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
              // Full song ignores the index, so leave it as it was
              activate(song.id, mutableRendererData.currentIndex);
              setRenderCurrentScene();
            }
      }
    >
      <div
        className="contents"
        data-testid="lyrics-slide-background"
        data-background-key={background?.key ?? ""}
      >
        <LyricsSlide
          song={song}
          template={template}
          index={null}
          background={background?.background}
        />
      </div>
    </Slide>
  );
};
