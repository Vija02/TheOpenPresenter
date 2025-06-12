import { Button, LogoFavicon } from "@repo/ui";
import { useCallback, useMemo } from "react";
import { FaPause, FaPlay, FaYoutube } from "react-icons/fa";
import { IoMdClose } from "react-icons/io";
import { MdHls } from "react-icons/md";
import { VscDebugRestart } from "react-icons/vsc";
import { Scrubber } from "react-scrubber";

import { InternalVideo, Video } from "../../src/types";
import { calculateActualSeek } from "../calculateActualSeek";
import { usePluginAPI } from "../pluginApi";
import { VideoThumbnail } from "./VideoThumbnail";
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

  const borderClass = useMemo(
    () =>
      currentVideoIsPlaying
        ? "border border-red-500"
        : "border border-black/20",
    [currentVideoIsPlaying],
  );

  return (
    <div className={`stack-col items-stretch shadow-md p-2 ${borderClass}`}>
      <div className="stack-col md:stack-row md:items-start gap-4 items-start">
        <VideoThumbnail video={video} />
        <div className="stack-row items-start justify-between flex-1">
          <div className="stack-col items-start">
            <h3 className="text-lg font-bold break-all">
              {video.metadata.title ?? video.url}
            </h3>
            <div className="stack-row">
              {!video.isInternalVideo ? (
                <a href={video.url} target="_blank" rel="noopener noreferrer">
                  <FaYoutube color="red" fontSize={24} />
                </a>
              ) : (
                <a href={video.url} target="_blank" rel="noopener noreferrer">
                  <div className="flex items-center justify-center bg-black w-6 h-6 p-0.5 rounded-sm">
                    <LogoFavicon />
                  </div>
                </a>
              )}
              {video.isInternalVideo &&
                (video as InternalVideo).hlsMediaName && (
                  <MdHls fontSize={24} />
                )}
            </div>
            <div className="stack-row">
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
            </div>
          </div>
          <Button
            variant="ghost"
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
          >
            <IoMdClose className="text-2xl cursor-pointer" />
          </Button>
        </div>
      </div>

      <div className="flex items-center">
        <div className="stack-row w-full gap-3">
          <Button
            onClick={onTogglePlay}
            variant={currentVideoIsPlaying ? "default" : "outline"}
            className={
              currentVideoIsPlaying ? "border-1 border-fill-default" : ""
            }
          >
            {currentVideoIsPlaying ? <FaPause /> : <FaPlay />}
          </Button>
          <div className="w-full flex items-center">
            <Scrubber
              min={0}
              max={0.999999}
              value={seek}
              onScrubChange={onSeekHandle}
              onScrubEnd={onSeekEnd}
              onScrubStart={onSeekHandle}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoCard;
