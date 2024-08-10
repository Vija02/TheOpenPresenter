import { Box, Flex, Heading, Text } from "@chakra-ui/react";
import { useMemo } from "react";

import MWLSongRenderView from "../../MWLRenderer/MWLSongRenderView";
import {
  cleanWhiteSpace,
  groupData,
  removeAuxiliaryText,
  removeChords,
} from "../../songHelpers";
import { pluginApi } from "../../util";

const MWLSongView = ({ songId }: { songId: number }) => {
  const songCaches = pluginApi.scene.useData((x) => x.pluginData.songCache);
  const songCache = useMemo(
    () => songCaches.find((x) => x.id === songId),
    [songCaches, songId],
  );

  if (!songCache) {
    return <Text>Loading...</Text>;
  }
  return <MWLSongViewInner songId={songId} />;
};

const MWLSongViewInner = ({ songId }: { songId: number }) => {
  const songCaches = pluginApi.scene.useData((x) => x.pluginData.songCache);
  const renderData = pluginApi.renderer.useData((x) => x);

  const mutableRendererData = pluginApi.renderer.useValtioData();
  const setRenderCurrentScene = pluginApi.useSetRenderCurrentScene();

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
        {Object.keys(groupedData).map((section, i) => (
          <Box
            key={i}
            cursor="pointer"
            onClick={() => {
              mutableRendererData.heading = section;
              mutableRendererData.songId = songId;
              setRenderCurrentScene();
            }}
          >
            <Text
              fontWeight="bold"
              textTransform="uppercase"
              fontSize="xs"
              mb={1}
            >
              {section}
            </Text>
            <Box
              aspectRatio={4 / 3}
              w="200px"
              border="1px"
              borderColor={
                section === renderData.heading && songId === renderData.songId
                  ? "blue.600"
                  : "gray.200"
              }
            >
              <MWLSongRenderView groupedData={groupedData} heading={section} />
            </Box>
          </Box>
        ))}
      </Flex>
    </Box>
  );
};

export default MWLSongView;
