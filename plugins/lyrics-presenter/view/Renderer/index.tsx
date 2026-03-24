import { useMemo } from "react";

import { Song } from "../../src";
import { getMergedSlideStyle } from "../../src/slideStyle";
import { processSong } from "../../src/songHelpers";
import { usePluginAPI } from "../pluginApi";
import FullSongRenderView from "./FullSongRenderView";
import SectionsRenderView from "./SectionsRenderView";
import "./index.css";

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
  const globalStyle = pluginApi.scene.useData((x) => x.pluginData.style);

  const groupedData = useMemo(
    () => processSong(song.content, song.setting.sectionOrder),
    [song.content, song.setting.sectionOrder],
  );

  return (
    <FullSongRenderView
      groupedData={groupedData}
      slideStyle={getMergedSlideStyle(globalStyle, song.styleOverride)}
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
  const globalStyle = pluginApi.scene.useData((x) => x.pluginData.style);

  const groupedData = useMemo(
    () => processSong(song.content, song.setting.sectionOrder),
    [song.content, song.setting.sectionOrder],
  );

  return (
    <SectionsRenderView
      key={currentIndex}
      groupedData={groupedData}
      currentIndex={currentIndex}
      slideStyle={getMergedSlideStyle(globalStyle, song.styleOverride)}
    />
  );
};

export default Renderer;
