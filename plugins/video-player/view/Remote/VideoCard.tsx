import { Box, Button, Flex, Link, Stack, Text, chakra } from "@chakra-ui/react";
import { LogoFavicon } from "@repo/ui";
import { useCallback, useMemo } from "react";
import { FaPause, FaPlay, FaYoutube } from "react-icons/fa";
import { IoMdClose as IoMdCloseRaw } from "react-icons/io";
import { MdHls } from "react-icons/md";
import { VscDebugRestart } from "react-icons/vsc";
import { Scrubber } from "react-scrubber";

import { InternalVideo, Video } from "../../src/types";
import { calculateActualSeek } from "../calculateActualSeek";
import { usePluginAPI } from "../pluginApi";
import { VideoThumbnail } from "./VideoThumbnail";
import { useSeek } from "./useSeek";

const IoMdClose = chakra(IoMdCloseRaw);

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

  const border = useMemo(
    () =>
      currentVideoIsPlaying
        ? "1px solid rgb(255, 0, 0)"
        : "1px solid rgba(0, 0, 0, 0.2)",
    [currentVideoIsPlaying],
  );

  return (
    <Stack direction="column" boxShadow="base" p={2} border={border}>
      <Stack direction={{ base: "column", md: "row" }} spacing={4}>
        <VideoThumbnail video={video} />
        <Stack direction="row" justifyContent="space-between" flex={1}>
          <Stack direction="column">
            <Text fontSize="lg" fontWeight="bold" wordBreak="break-all">
              {video.metadata.title ?? video.url}
            </Text>
            <Stack direction="row">
              {!video.isInternalVideo ? (
                <Link isExternal href={video.url}>
                  <FaYoutube color="red" fontSize={24} />
                </Link>
              ) : (
                <Link isExternal href={video.url}>
                  <Flex
                    alignItems="center"
                    justifyContent="center"
                    bg="black"
                    width="24px"
                    height="24px"
                    p="2px"
                    borderRadius="sm"
                  >
                    <LogoFavicon />
                  </Flex>
                </Link>
              )}
              {video.isInternalVideo &&
                (video as InternalVideo).hlsMediaName && (
                  <MdHls fontSize={24} />
                )}
            </Stack>
            <Stack direction="row">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onSeekEnd(0);
                  if (!currentVideoIsPlaying) {
                    onTogglePlay();
                  }
                }}
              >
                <VscDebugRestart />
              </Button>
            </Stack>
          </Stack>
          <IoMdClose
            fontSize="2xl"
            cursor="pointer"
            onClick={() => {
              const index = mutableSceneData.pluginData.videos.findIndex(
                (x) => x.id === video.id,
              );

              mutableSceneData.pluginData.videos.splice(index, 1);

              if (
                mutableRendererData.currentPlayingVideo?.videoId === video.id
              ) {
                mutableRendererData.currentPlayingVideo = null;
                mutableRendererData.isPlaying = false;
                delete mutableRendererData.videoSeeks[video.id];
              }
            }}
          />
        </Stack>
      </Stack>

      <Box alignItems="center">
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
    </Stack>
  );
};

export default VideoCard;
