import { Box, Button, Flex, Stack, Text } from "@chakra-ui/react";
import { useCallback, useMemo } from "react";
import { FaPause, FaPlay } from "react-icons/fa";
import { Scrubber } from "react-scrubber";

import { Video } from "../../src/types";
import { calculateActualSeek } from "../calculateActualSeek";
import { usePluginAPI } from "../pluginApi";
import { useSeek } from "./useSeek";

// TODO: Handle if no duration
const VideoCard = ({ video }: { video: Video }) => {
  const pluginApi = usePluginAPI();

  const mutableSceneData = pluginApi.scene.useValtioData();
  const mutableRendererData = pluginApi.renderer.useValtioData();

  const setRenderCurrentScene = pluginApi.renderer.setRenderCurrentScene;

  const isPlaying = pluginApi.renderer.useData((x) => x.isPlaying);
  const videoId = pluginApi.renderer.useData(
    (x) => x.currentPlayingVideo?.videoId,
  );
  const currentVideoIsPlaying = useMemo(
    () => isPlaying && videoId === video.id,
    [isPlaying, video.id, videoId],
  );

  const seek = useSeek(video, currentVideoIsPlaying);

  const onTogglePlay = useCallback(() => {
    // Before we pause/play, if we have any currently playing video
    // We need to update the seek timings
    if (mutableRendererData.currentPlayingVideo && isPlaying) {
      const videoDuration = mutableSceneData.pluginData.videos.find(
        (v) => v.id === mutableRendererData.currentPlayingVideo!.videoId,
      )?.metadata.duration;
      const finalSeek = calculateActualSeek(
        mutableRendererData.currentPlayingVideo,
        videoDuration ?? 0,
      );

      mutableRendererData.videoSeeks[
        mutableRendererData.currentPlayingVideo!.videoId
      ] = finalSeek;
    }

    if (currentVideoIsPlaying) {
      mutableRendererData.isPlaying = false;
    } else {
      mutableRendererData.isPlaying = true;
      mutableRendererData.currentPlayingVideo = {
        uid: Math.random().toString(),
        playFrom: mutableRendererData.videoSeeks[video.id] ?? 0,
        startedAt: new Date().getTime(),
        videoId: video.id,
      };
      setRenderCurrentScene();
    }
  }, [
    currentVideoIsPlaying,
    isPlaying,
    mutableRendererData,
    mutableSceneData.pluginData.videos,
    setRenderCurrentScene,
    video.id,
  ]);

  const onSeekHandle = useCallback(
    (v: number) => {
      mutableRendererData.videoSeeks[video.id] = v;

      mutableRendererData.currentPlayingVideo!.uid = Math.random().toString();
      mutableRendererData.currentPlayingVideo!.playFrom = v;
      mutableRendererData.currentPlayingVideo!.startedAt = new Date().getTime();

      mutableRendererData.currentPlayingVideo!.wasPlayingBeforeSeek =
        mutableRendererData.currentPlayingVideo!.wasPlayingBeforeSeek ||
        currentVideoIsPlaying;

      mutableRendererData.isPlaying = false;
    },
    [currentVideoIsPlaying, mutableRendererData, video.id],
  );
  const onSeekEnd = useCallback(
    (v: number) => {
      mutableRendererData.videoSeeks[video.id] = v;

      mutableRendererData.currentPlayingVideo!.uid = Math.random().toString();
      mutableRendererData.currentPlayingVideo!.playFrom = v;
      mutableRendererData.currentPlayingVideo!.startedAt = new Date().getTime();

      if (mutableRendererData.currentPlayingVideo?.wasPlayingBeforeSeek) {
        mutableRendererData.isPlaying = true;
        mutableRendererData.currentPlayingVideo!.wasPlayingBeforeSeek = null;
      }
    },
    [mutableRendererData, video.id],
  );

  const color = useMemo(
    () => (currentVideoIsPlaying ? "rgb(136, 53, 53)" : "#2F2F2F"),
    [currentVideoIsPlaying],
  );

  return (
    <Box>
      <Box
        p={1}
        border="1px solid"
        borderColor={color}
        borderBottom={0}
        bg={color}
      >
        <Text fontWeight="bold" color="white" wordBreak="break-all">
          {video.metadata.title ?? video.url}
        </Text>
      </Box>
      <Box p={2} alignItems="center" border="1px solid" borderColor={color}>
        <Stack direction="row" w="100%" gap={3}>
          <Button
            size="md"
            onClick={onTogglePlay}
            {...(currentVideoIsPlaying
              ? { bg: "black", color: "white", _hover: { bg: "gray.700" } }
              : { variant: "outline", colorScheme: "grey" })}
          >
            {currentVideoIsPlaying ? <FaPause /> : <FaPlay />}
          </Button>
          <Flex w="100%" alignItems="center">
            <Scrubber
              min={0}
              max={0.999999}
              value={seek}
              onScrubChange={onSeekHandle}
              onScrubEnd={onSeekEnd}
              onScrubStart={onSeekHandle}
            />
          </Flex>
        </Stack>
      </Box>
    </Box>
  );
};

export default VideoCard;
