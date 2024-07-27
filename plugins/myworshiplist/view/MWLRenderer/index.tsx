import { Box } from "@chakra-ui/react";
import { useMemo } from "react";

import {
  cleanWhiteSpace,
  groupData,
  removeAuxiliaryText,
  removeChords,
} from "../songHelpers";
import { pluginApi } from "../util";
import MWLSongRenderView from "./MWLSongRenderView";

const MWLRenderer = () => {
  const data = pluginApi.renderer.useData((x) => x);
  const songId = data.songId;
  const heading = data.heading;

  const songCaches = pluginApi.scene.useData((x) => x.pluginData.songCache);

  const songCache = useMemo(
    () => songCaches.find((x) => x.id === songId)!,
    [songCaches, songId],
  );

  const cleanData = useMemo(
    () =>
      removeAuxiliaryText(
        cleanWhiteSpace(removeChords(songCache.content.split("<br>"))),
      ),
    [songCache.content],
  );

  const groupedData = useMemo(() => groupData(cleanData), [cleanData]);

  return (
    <Box w="100vw" h="100vh">
      <MWLSongRenderView
        key={heading}
        groupedData={groupedData}
        heading={heading}
      />
    </Box>
  );
};

export default MWLRenderer;
