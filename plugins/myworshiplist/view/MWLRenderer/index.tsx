import { Box } from "@chakra-ui/react";
import { useMemo } from "react";

import { Song } from "../../src";
import { getSlideStyle } from "../../src/slideStyle";
import { usePluginAPI } from "../pluginApi";
import {
  cleanWhiteSpace,
  groupData,
  removeAuxiliaryText,
  removeChords,
} from "../songHelpers";
import MWLFullSongRenderView from "./MWLFullSongRenderView";
import MWLSectionsRenderView from "./MWLSectionsRenderView";

const MWLRenderer = () => {
  return (
    <Box w="100vw" h="100vh">
      <MWLRendererInner />
    </Box>
  );
};

const MWLRendererInner = () => {
  const pluginApi = usePluginAPI();
  const data = pluginApi.renderer.useData((x) => x);
  const songId = useMemo(() => data.songId, [data.songId]);
  const heading = useMemo(() => data.heading, [data.heading]);

  const songs = pluginApi.scene.useData((x) => x.pluginData.songs);

  const song = songs.find((x) => x.id === songId)!;

  if (song.setting.displayType === "sections") {
    return <MWLSectionsRenderer song={song} heading={heading} />;
  } else if (song.setting.displayType === "fullSong") {
    return <MWLFullSongRenderer song={song} />;
  }
  return null;
};

const MWLFullSongRenderer = ({ song }: { song: Song }) => {
  const pluginApi = usePluginAPI();
  const slideStyle = pluginApi.scene.useData((x) => x.pluginData.style);

  const songCache = useMemo(() => song.cachedData, [song.cachedData]);

  const cleanData = useMemo(
    () =>
      removeAuxiliaryText(
        cleanWhiteSpace(removeChords(songCache?.content.split("<br>") ?? [])),
      ),
    [songCache?.content],
  );

  const groupedData = useMemo(() => groupData(cleanData), [cleanData]);

  return (
    <MWLFullSongRenderView
      groupedData={groupedData}
      slideStyle={getSlideStyle(slideStyle)}
    />
  );
};

const MWLSectionsRenderer = ({
  song,
  heading,
}: {
  song: Song;
  heading: string;
}) => {
  const pluginApi = usePluginAPI();
  const slideStyle = pluginApi.scene.useData((x) => x.pluginData.style);

  const songCache = useMemo(() => song.cachedData, [song.cachedData]);

  const cleanData = useMemo(
    () =>
      removeAuxiliaryText(
        cleanWhiteSpace(removeChords(songCache?.content.split("<br>") ?? [])),
      ),
    [songCache?.content],
  );

  const groupedData = useMemo(() => groupData(cleanData), [cleanData]);

  if (!songCache) {
    return null;
  }

  return (
    <MWLSectionsRenderView
      key={heading}
      groupedData={groupedData}
      heading={heading}
      slideStyle={getSlideStyle(slideStyle)}
    />
  );
};

export default MWLRenderer;
