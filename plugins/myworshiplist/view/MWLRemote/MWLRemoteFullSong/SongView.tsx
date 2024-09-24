import { Box, Heading, Text } from "@chakra-ui/react";
import { Slide } from "@repo/ui";
import React, { useMemo } from "react";

import { getSlideStyle } from "../../../src/slideStyle";
import { CustomTypeData } from "../../../src/types";
import MWLFullSongRenderView from "../../MWLRenderer/MWLFullSongRenderView";
import { usePluginAPI } from "../../pluginApi";
import {
  cleanWhiteSpace,
  groupData,
  removeAuxiliaryText,
  removeChords,
} from "../../songHelpers";

const MWLSongView = React.memo(({ songId }: { songId: number }) => {
  const pluginApi = usePluginAPI();
  const songCaches = pluginApi.scene.useData(
    (x) => (x.pluginData as CustomTypeData).songCache,
  );
  const songCache = useMemo(
    () => songCaches.find((x) => x.id === songId),
    [songCaches, songId],
  );

  if (!songCache) {
    return <Text>Loading...</Text>;
  }
  return <MWLSongViewInner songId={songId} />;
});

const MWLSongViewInner = React.memo(({ songId }: { songId: number }) => {
  const pluginApi = usePluginAPI();
  const songCaches = pluginApi.scene.useData(
    (x) => (x.pluginData as CustomTypeData).songCache,
  );
  const slideStyle = pluginApi.scene.useData((x) => x.pluginData.style);
  const renderData = pluginApi.renderer.useData((x) => x);

  const mutableRendererData = pluginApi.renderer.useValtioData();
  const setRenderCurrentScene = pluginApi.renderer.setRenderCurrentScene;

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
    <Box py={3}>
      <Heading fontSize="xl" mb={2}>
        {songCache.title}
      </Heading>
      <Slide
        isActive={songId === renderData.songId}
        onClick={() => {
          mutableRendererData.songId = songId;
          setRenderCurrentScene();
        }}
      >
        <MWLFullSongRenderView
          groupedData={groupedData}
          slideStyle={getSlideStyle(slideStyle)}
        />
      </Slide>
    </Box>
  );
});

export default MWLSongView;
