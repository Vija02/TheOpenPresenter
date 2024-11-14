import { useMemo } from "react";

import { Song } from "../../src";
import { getSlideStyle } from "../../src/slideStyle";
import { usePluginAPI } from "../pluginApi";
import { processSongCache } from "../songHelpers";
import MWLFullSongRenderView from "./MWLFullSongRenderView";
import MWLSectionsRenderView from "./MWLSectionsRenderView";

const MWLRenderer = () => {
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
    return <MWLFullSongRenderer song={song} />;
  }

  if (currentIndex === undefined || currentIndex === null) {
    return null;
  }
  if (song.setting.displayType === "sections") {
    return <MWLSectionsRenderer song={song} currentIndex={currentIndex} />;
  }

  return null;
};

const MWLFullSongRenderer = ({ song }: { song: Song }) => {
  const pluginApi = usePluginAPI();
  const slideStyle = pluginApi.scene.useData((x) => x.pluginData.style);

  const groupedData = useMemo(() => processSongCache(song), [song]);

  return (
    <MWLFullSongRenderView
      groupedData={groupedData}
      slideStyle={getSlideStyle(slideStyle)}
    />
  );
};

const MWLSectionsRenderer = ({
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
    <MWLSectionsRenderView
      key={currentIndex}
      groupedData={groupedData}
      currentIndex={currentIndex}
      slideStyle={getSlideStyle(slideStyle)}
    />
  );
};

export default MWLRenderer;
