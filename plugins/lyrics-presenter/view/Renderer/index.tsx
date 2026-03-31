import { cx } from "class-variance-authority";
import { useMemo } from "react";

import { Song } from "../../src";
import { getMergedSlideStyle } from "../../src/slideStyle";
import { processSong } from "../../src/songHelpers";
import { usePluginAPI } from "../pluginApi";
import FullSongRenderView from "./FullSongRenderView";
import SectionsRenderView from "./SectionsRenderView";
import VideoBackgroundRenderer from "./VideoBackgroundRenderer";
import "./index.css";

const Renderer = () => {
  const pluginApi = usePluginAPI();
  // Get derivation config to check if we should hide background
  const derivation = pluginApi.renderer.useDerivation();
  const isDerived = derivation !== null;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Hide video background when derived (e.g., confidence monitor showing next slide) */}
      {!isDerived && <VideoBackgroundRenderer />}
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
  const derivationOffset = pluginApi.renderer.useDerivationOffset();

  const songs = pluginApi.scene.useData((x) => x.pluginData.songs);

  const song = songs.find((x) => x.id === songId);

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
    if (song.setting.displayType === "fullSong") {
      return <FullSongRenderer song={song} />;
    }

    if (currentIndex === undefined || currentIndex === null) {
      return null;
    }
    if (song.setting.displayType === "sections") {
      return <SectionsRenderer song={song} currentIndex={currentIndex} />;
    }

    return null;
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

const FullSongRenderer = ({ song }: { song: Song }) => {
  const pluginApi = usePluginAPI();
  const globalStyle = pluginApi.scene.useData((x) => x.pluginData.style);

  const groupedData = useMemo(
    () => processSong(song.content, song.setting.sectionOrder),
    [song.content, song.setting.sectionOrder],
  );

  const slideStyle = getMergedSlideStyle(globalStyle, song.styleOverride);

  return (
    <FullSongRenderView groupedData={groupedData} slideStyle={slideStyle} />
  );
};

const SectionsRenderer = ({
  song,
  currentIndex,
}: {
  song: Song;
  currentIndex: number;
}) => {
  const pluginApi = usePluginAPI();
  const globalStyle = pluginApi.scene.useData((x) => x.pluginData.style);

  const groupedData = useMemo(
    () => processSong(song.content, song.setting.sectionOrder),
    [song.content, song.setting.sectionOrder],
  );

  const slideStyle = getMergedSlideStyle(globalStyle, song.styleOverride);

  return (
    <SectionsRenderView
      key={currentIndex}
      groupedData={groupedData}
      currentIndex={currentIndex}
      slideStyle={slideStyle}
    />
  );
};

export default Renderer;
