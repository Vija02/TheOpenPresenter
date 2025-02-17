import { Box, Img, Skeleton } from "@chakra-ui/react";
import { useMemo } from "react";

import { InternalVideo, Video } from "../../src";
import { usePluginAPI } from "../pluginApi";

export const VideoThumbnail = ({ video }: { video: Video }) => {
  const pluginApi = usePluginAPI();

  const url = useMemo(() => {
    if (video.isInternalVideo && (video as InternalVideo).thumbnailMediaName) {
      return pluginApi.media.getUrl(
        (video as InternalVideo).thumbnailMediaName!,
      );
    }
    if (video.metadata.thumbnailUrl) {
      return video.metadata.thumbnailUrl;
    }
    return null;
  }, [pluginApi.media, video]);

  return (
    <Box position="relative">
      {url ? (
        <Img
          src={url}
          width={{ base: "100%", md: 300 }}
          height="100%"
          borderRadius="lg"
        />
      ) : (
        <Skeleton
          aspectRatio={16 / 9}
          width={{ base: "100%", md: 300 }}
          height="100%"
          borderRadius="lg"
        />
      )}
      {video.metadata.duration !== undefined && (
        <Box
          position="absolute"
          bottom={2}
          right={2}
          bg="rgb(28, 28, 28)"
          opacity={0.9}
          color="white"
          rounded="sm"
          px={1}
          fontSize="xs"
          fontWeight="600"
        >
          {formatDuration(video.metadata.duration)}
        </Box>
      )}
    </Box>
  );
};

function formatDuration(seconds: number) {
  const timeStr = new Date(seconds * 1000).toISOString().slice(11, 19);
  return timeStr.startsWith("00:") ? timeStr.slice(3) : timeStr;
}
