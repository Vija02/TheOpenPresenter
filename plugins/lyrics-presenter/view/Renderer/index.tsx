import { cx } from "class-variance-authority";
import { useMemo } from "react";

import { Song } from "../../src";
import {
  HIGHLIGHT_LIVE_PARAM,
  LOOK_PARAM,
  LOOK_TEXT_COLOR,
  OFFSET_PARAM,
  SHOW_BACKGROUND_PARAM,
  SHOW_CHORDS_PARAM,
  SONG_LOOK,
  TEXT_COLOR_PARAM,
} from "../../src/derivation";
import { FULL_SONG_LOOK, lookKeyFor, songLookTemplate } from "../../src/looks";
import { processSong } from "../../src/songHelpers";
import { usePluginAPI } from "../pluginApi";
import BackgroundRenderer from "./BackgroundRenderer";
import { LyricsSlide } from "./LyricsSlide";
import "./index.css";

const Renderer = () => {
  const pluginApi = usePluginAPI();
  const showBackground = pluginApi.renderer.useDerivationParam(
    SHOW_BACKGROUND_PARAM,
    true,
  );

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {showBackground && <BackgroundRenderer />}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          height: "100%",
        }}
      >
        <SlideRenderer />
      </div>
    </div>
  );
};

const SlideRenderer = () => {
  const pluginApi = usePluginAPI();
  const overlayType = pluginApi.renderer.useOverlayType();
  const data = pluginApi.renderer.useData((x) => x);
  const songId = useMemo(() => data.songId, [data.songId]);
  const baseCurrentIndex = useMemo(
    () => data.currentIndex,
    [data.currentIndex],
  );

  // Get derivation offset for confidence monitor mode
  const derivationOffset = pluginApi.renderer.useDerivationParam(
    OFFSET_PARAM,
    0,
  );

  const showChords = pluginApi.renderer.useDerivationParam(
    SHOW_CHORDS_PARAM,
    false,
  );
  const lookParam = pluginApi.renderer.useDerivationParam(
    LOOK_PARAM,
    SONG_LOOK,
  );
  const highlightLive = pluginApi.renderer.useDerivationParam(
    HIGHLIGHT_LIVE_PARAM,
    false,
  );
  const textColor = pluginApi.renderer.useDerivationParam(
    TEXT_COLOR_PARAM,
    LOOK_TEXT_COLOR,
  );

  const songs = pluginApi.scene.useData((x) => x.pluginData.songs);

  const song = songs.find((x) => x.id === songId);
  const lookKey =
    song && lookParam === SONG_LOOK ? lookKeyFor(song) : lookParam;
  // The full song look shows the whole song, whichever way the song is set
  const fullSong = lookKey === FULL_SONG_LOOK;

  // Process song to get total slide count for bounds checking
  const groupedData = useMemo(
    () =>
      song ? processSong(song.content, song.setting.sectionOrder) : undefined,
    [song],
  );

  const totalSlides = useMemo(
    () =>
      groupedData
        ?.map((x) => x.slides.length)
        .reduce((acc, val) => acc + val, 0) ?? 0,
    [groupedData],
  );

  // Apply derivation offset to currentIndex
  // Returns null if derived index is out of bounds (to show nothing)
  const currentIndex = useMemo(() => {
    if (baseCurrentIndex === undefined || baseCurrentIndex === null) {
      return baseCurrentIndex;
    }
    if (derivationOffset === 0) {
      return baseCurrentIndex;
    }
    const derivedIndex = baseCurrentIndex + derivationOffset;
    // Return null if out of bounds (shows nothing for "next slide" on last slide)
    if (derivedIndex < 0 || derivedIndex >= totalSlides) {
      return null;
    }
    return derivedIndex;
  }, [baseCurrentIndex, derivationOffset, totalSlides]);

  const isCleared = overlayType === "clear";

  const renderContent = () => {
    if (!song) {
      return null;
    }
    if (fullSong) {
      return (
        <SongSlide
          key="full"
          song={song}
          lookKey={lookKey}
          index={null}
          showChords={showChords}
          highlight={highlightLive ? (baseCurrentIndex ?? null) : null}
          textColor={textColor || null}
        />
      );
    }
    if (currentIndex === undefined || currentIndex === null) {
      return null;
    }
    return (
      <SongSlide
        key={currentIndex}
        song={song}
        lookKey={lookKey}
        index={currentIndex}
        showChords={showChords}
        textColor={textColor || null}
      />
    );
  };

  return (
    <div
      className={cx(isCleared ? "transition-fade-out" : "transition-fade-in")}
      style={{ width: "100%", height: "100%" }}
    >
      {renderContent()}
    </div>
  );
};

const SongSlide = ({
  song,
  lookKey,
  index,
  showChords,
  highlight = null,
  textColor = null,
}: {
  song: Song;
  lookKey: string;
  index: number | null;
  showChords: boolean;
  highlight?: number | null;
  textColor?: string | null;
}) => {
  const pluginApi = usePluginAPI();
  const looks = pluginApi.scene.useData((x) => x.pluginData.looks);

  return (
    <LyricsSlide
      song={song}
      template={songLookTemplate(song, lookKey, looks)}
      index={index}
      showChords={showChords}
      fullSong={lookKey === FULL_SONG_LOOK}
      highlight={highlight}
      textColor={textColor}
    />
  );
};

export default Renderer;
