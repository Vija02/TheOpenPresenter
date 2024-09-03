import { Box } from "@chakra-ui/react";
import { useMemo } from "react";

import { CustomTypeData, SongCache } from "../../src";
import { getSlideStyle } from "../../src/slideStyle";
import { usePluginAPI } from "../pluginApi";
import {
  cleanWhiteSpace,
  groupData,
  removeAuxiliaryText,
  removeChords,
} from "../songHelpers";
import MWLSongRenderView from "./MWLSongRenderView";

const MWLRenderer = () => {
  const pluginApi = usePluginAPI();
  const type = pluginApi.scene.useData((x) => x.pluginData.type);
  if (type === "unselected") {
    return null;
  }

  // TODO: Handle each type
  return <MWLRendererInner />;
};

const MWLRendererInner = () => {
  const pluginApi = usePluginAPI();
  const data = pluginApi.renderer.useData((x) => x);
  const songId = useMemo(() => data.songId, [data.songId]);
  const heading = useMemo(() => data.heading, [data.heading]);

  const songCaches = pluginApi.scene.useData<SongCache[]>(
    (x) => (x.pluginData as CustomTypeData).songCache,
  );
  const slideStyle = pluginApi.scene.useData((x) => x.pluginData.style);

  const songCache = useMemo(
    () => songCaches.find((x) => x.id === songId),
    [songCaches, songId],
  );

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
    <Box w="100vw" h="100vh">
      <MWLSongRenderView
        key={heading}
        groupedData={groupedData}
        heading={heading}
        slideStyle={getSlideStyle(slideStyle)}
      />
    </Box>
  );
};

export default MWLRenderer;
