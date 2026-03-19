import { Button, LogoFavicon } from "@repo/ui";
import { InternalVideo, Video, VideoPlaybackState } from "@repo/video";
import {
  computePlaybackState,
  useComputedPlaybackState,
  useVideoControls,
} from "@repo/video/client";
import { useCallback, useMemo } from "react";
import { FaPause, FaPlay, FaStop, FaYoutube } from "react-icons/fa";
import { IoMdClose } from "react-icons/io";
import { MdHls, MdLoop } from "react-icons/md";
import { VscDebugRestart } from "react-icons/vsc";
import { Scrubber } from "react-scrubber";

import { usePluginAPI } from "../pluginApi";
import { VideoThumbnail } from "./VideoThumbnail";

// TODO: Handle if no duration
const VideoCard = ({ video }: { video: Video }) => {
  const pluginApi = usePluginAPI();

  const mutableSceneData = pluginApi.scene.useValtioData();
  const mutableRendererData = pluginApi.renderer.useValtioData();

  const setRenderCurrentScene = pluginApi.renderer.setRenderCurrentScene;

  const activeVideoId = pluginApi.renderer.useData((x) => x.activeVideoId);
  const videoStates = pluginApi.renderer.useData((x) => x.videoStates);
  const playbackState: VideoPlaybackState | null = useMemo(
    () => videoStates[video.id] ?? null,
    [video.id, videoStates],
  );
  const { isPlaying, currentSeek, isEnded } = useComputedPlaybackState(
    playbackState,
    video.metadata.duration,
  );
  const isActive = useMemo(
    () => activeVideoId === video.id,
    [activeVideoId, video.id],
  );

  const videoControls = useVideoControls(
    useCallback(
      () => mutableRendererData.videoStates[video.id] ?? null,
      [mutableRendererData.videoStates, video.id],
    ),
    mutableRendererData.videoStates[video.id]!,
    video.metadata.duration ?? 0,
  );

  const pauseOtherVideos = useCallback(() => {
    for (const [videoId, state] of Object.entries(
      mutableRendererData.videoStates,
    )) {
      if (videoId !== video.id && state.isPlaying) {
        const vid = mutableSceneData.pluginData.videos.find(
          (v) => v.id === videoId,
        );
        const duration = vid?.metadata.duration ?? 0;
        const { currentSeek } = computePlaybackState(state, duration);
        mutableRendererData.videoStates[videoId]!.uid =
          Math.random().toString();
        mutableRendererData.videoStates[videoId]!.seek = currentSeek;
        mutableRendererData.videoStates[videoId]!.isPlaying = false;
        mutableRendererData.videoStates[videoId]!.startedAt = Date.now();
      }
    }
  }, [mutableRendererData, mutableSceneData.pluginData.videos, video.id]);

  const onTogglePlay = useCallback(() => {
    if (!mutableRendererData.videoStates[video.id]) return;

    if (isPlaying) {
      videoControls.pause();
    } else {
      // Pause other videos first
      pauseOtherVideos();

      mutableRendererData.activeVideoId = video.id;
      videoControls.play();
      setRenderCurrentScene();
    }
  }, [
    video.id,
    isPlaying,
    pauseOtherVideos,
    mutableRendererData,
    setRenderCurrentScene,
    videoControls,
  ]);

  const onDelete = useCallback(() => {
    const index = mutableSceneData.pluginData.videos.findIndex(
      (x) => x.id === video.id,
    );

    mutableSceneData.pluginData.videos.splice(index, 1);

    // Clean up state
    delete mutableRendererData.videoStates[video.id];

    // Clear active video if this was the active one
    if (mutableRendererData.activeVideoId === video.id) {
      mutableRendererData.activeVideoId = null;
    }
  }, [mutableSceneData, mutableRendererData, video.id]);

  const borderClass = useMemo(
    () => (isActive ? "border border-red-500" : "border border-black/20"),
    [isActive],
  );

  return (
    <div className={`stack-col items-stretch shadow-md p-2 ${borderClass}`}>
      <div className="stack-col md:stack-row md:items-start gap-4 items-stretch">
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
              <Button variant="outline" size="sm" onClick={videoControls.stop}>
                <FaStop />
              </Button>
              <Button
                variant={
                  playbackState?.onFinishBehaviour === "loop"
                    ? "default"
                    : "outline"
                }
                size="sm"
                onClick={videoControls.toggleLoop}
              >
                <MdLoop />
              </Button>
            </div>
          </div>
          <Button variant="ghost" onClick={onDelete}>
            <IoMdClose className="text-2xl cursor-pointer" />
          </Button>
        </div>
      </div>

      <div className="flex items-center">
        <div className="stack-row w-full gap-3">
          <Button
            onClick={onTogglePlay}
            variant={isPlaying ? "default" : "outline"}
            className={isPlaying ? "border-1 border-fill-default" : ""}
          >
            {isPlaying ? (
              <FaPause />
            ) : isEnded ? (
              <VscDebugRestart />
            ) : (
              <FaPlay />
            )}
          </Button>
          <div className="w-full flex items-center">
            <Scrubber
              min={0}
              max={0.999999}
              value={currentSeek}
              onScrubChange={videoControls.updateSeeking}
              onScrubEnd={videoControls.endSeeking}
              onScrubStart={videoControls.startSeeking}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoCard;
