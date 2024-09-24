import { Box, Flex, Heading, Text } from "@chakra-ui/react";
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
      <Flex gap={3} flexWrap="wrap">
        <Box
          cursor="pointer"
          onClick={() => {
            mutableRendererData.songId = songId;
            setRenderCurrentScene();
          }}
        >
          <Box
            aspectRatio={4 / 3}
            w="200px"
            borderWidth="4px"
            borderColor={
              songId === renderData.songId ? "red.600" : "transparent"
            }
          >
            <MWLFullSongRenderView
              groupedData={groupedData}
              slideStyle={getSlideStyle(slideStyle)}
            />
          </Box>
        </Box>
      </Flex>
    </Box>
  );
});

export default MWLSongView;
