import { Box, Flex, Heading, Text } from "@chakra-ui/react";
import { useMemo } from "react";

import {
  cleanWhiteSpace,
  groupData,
  removeAuxiliaryText,
  removeChords,
} from "../../songHelpers";
import { useSceneData } from "../../util";

const MWLSongView = ({ songId }: { songId: number }) => {
  const songCaches = useSceneData((x) => x.data.songCache);
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
  const songCaches = useSceneData((x) => x.data.songCache);

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
        {Object.entries(groupedData).map(([section, content], i) => (
          <Box key={i}>
            <Text
              fontWeight="bold"
              textTransform="uppercase"
              fontSize="xs"
              mb={1}
            >
              {section}
            </Text>
            <Box
              bg="gray.900"
              color="white"
              p={2}
              aspectRatio={4 / 3}
              w="200px"
              overflow="hidden"
            >
              <Text as="pre">{content.join("\n")}</Text>
            </Box>
          </Box>
        ))}
      </Flex>
    </Box>
  );
};

export default MWLSongView;
