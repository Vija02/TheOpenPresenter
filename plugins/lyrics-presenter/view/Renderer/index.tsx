import { useMemo } from "react";

import { Song } from "../../src";
import { getSlideStyle } from "../../src/slideStyle";
import { usePluginAPI } from "../pluginApi";
import { processSongCache } from "../songHelpers";
import FullSongRenderView from "./FullSongRenderView";
import SectionsRenderView from "./SectionsRenderView";

const Renderer = () => {
  const pluginApi = usePluginAPI();
  const data = pluginApi.renderer.useData((x) => x);
  const songId = useMemo(() => data.songId, [data.songId]);
  const currentIndex = useMemo(() => data.currentIndex, [data.currentIndex]);

  const songs = pluginApi.scene.useData((x) => x.pluginData.songs);

  const song = songs.find((x) => x.id === songId);

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

const FullSongRenderer = ({ song }: { song: Song }) => {
  const pluginApi = usePluginAPI();
  const slideStyle = pluginApi.scene.useData((x) => x.pluginData.style);

  const groupedData = useMemo(() => processSongCache(song), [song]);

  return (
    <FullSongRenderView
      groupedData={groupedData}
      slideStyle={getSlideStyle(slideStyle)}
    />
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
  const slideStyle = pluginApi.scene.useData((x) => x.pluginData.style);

  const songCache = useMemo(() => song.cachedData, [song.cachedData]);
  const groupedData = useMemo(() => processSongCache(song), [song]);

  if (!songCache) {
    return null;
  }

  return (
    <SectionsRenderView
      key={currentIndex}
      groupedData={groupedData}
      currentIndex={currentIndex}
      slideStyle={getSlideStyle(slideStyle)}
    />
  );
};

export default Renderer;
