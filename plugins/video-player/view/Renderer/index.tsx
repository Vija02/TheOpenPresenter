import { extractMediaName } from "@repo/lib";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactPlayer from "react-player/lazy";

import { InternalVideo } from "../../src";
import { calculateActualSeek } from "../calculateActualSeek";
import { usePluginAPI } from "../pluginApi";

const VideoPlayerRenderer = () => {
  const pluginApi = usePluginAPI();

  const currentPlayingVideo = pluginApi.renderer.useData(
    (x) => x.currentPlayingVideo,
  );

  if (!currentPlayingVideo) {
    return null;
  }

  return <VideoPlayerRendererInner />;
};

const VideoPlayerRendererInner = () => {
  const pluginApi = usePluginAPI();

  const currentPlayingVideo = pluginApi.renderer.useData(
    (x) => x.currentPlayingVideo!,
  );

  return <Player key={currentPlayingVideo.videoId} />;
};

const Player = () => {
  const pluginApi = usePluginAPI();

  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);

  const [ready, setReady] = useState(false);
  const [isEnded, setIsEnded] = useState(false);

  const ref = useRef<ReactPlayer>(null);

  const videos = pluginApi.scene.useData((x) => x.pluginData.videos);
  const isPlaying = pluginApi.renderer.useData((x) => x.isPlaying);
  const currentPlayingVideo = pluginApi.renderer.useData(
    (x) => x.currentPlayingVideo!,
  );
  const volume = pluginApi.renderer.useData((x) => x.volume);

  const mutableSceneData = pluginApi.scene.useValtioData();

  const currentVideo = useMemo(
    () => videos.find((vid) => vid.id === currentPlayingVideo.videoId),
    [currentPlayingVideo.videoId, videos],
  );

  useEffect(() => {
    let next: string;

    if (currentVideo?.url) {
      next = currentVideo.url;

      // Handle upgrade to HLS
      if (currentVideo.isInternalVideo) {
        const vid = currentVideo as InternalVideo;

        if (vid.hlsMediaName) {
          // We only want to upgrade if it's first play or during pause
          // TODO: Make this to test locally instead
          if (currentVideoUrl !== currentVideo.url || !isPlaying) {
            next = pluginApi.media.resolveMediaUrl(
              extractMediaName(vid.hlsMediaName),
            );
          }
        }
      }
    } else {
      return;
    }

    if (next && currentVideoUrl !== next) {
      setCurrentVideoUrl(next);
    }
  }, [currentVideo, currentVideoUrl, isPlaying, pluginApi.media]);

  const canPlay = pluginApi.audio.useCanPlay({ skipCheck: !isPlaying });

  const isYouTube = useMemo(() => {
    return currentVideoUrl
      ? currentVideoUrl.includes("youtube.com") ||
          currentVideoUrl.includes("youtu.be")
      : false;
  }, [currentVideoUrl]);

  // Reset ended state when playing resumes
  useEffect(() => {
    if (isPlaying) {
      setIsEnded(false);
    }
  }, [isPlaying]);

  const setVideoSeek = useCallback(
    (manual?: boolean) => {
      if (ready) {
        const duration = currentVideo?.metadata.duration ?? 0;

        const targetSeek = calculateActualSeek(currentPlayingVideo, duration);

        const currentTime = ref.current?.getCurrentTime();
        const currentSeek = (currentTime ?? 0) / duration;

        // 2 second tolerance
        const tolerance = 2 / duration;
        if (manual || Math.abs(currentSeek - targetSeek) > tolerance) {
          ref.current?.seekTo(targetSeek);
        }
      }
    },
    [currentPlayingVideo, currentVideo?.metadata.duration, ready],
  );

  // Handle on the go seeking
  useEffect(() => {
    if (ready && currentVideo?.metadata.duration) {
      setVideoSeek(true);
    }
  }, [
    currentVideo?.metadata.duration,
    ready,
    setVideoSeek,
    // Run this anytime UID is updated
    currentPlayingVideo.uid,
  ]);

  if (!currentVideoUrl) {
    return null;
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <ReactPlayer
        ref={ref}
        height="100%"
        width="100%"
        muted={!canPlay}
        volume={volume}
        playing={isPlaying}
        // TODO: Get this earlier
        onDuration={(dur) => {
          const index = mutableSceneData.pluginData.videos.findIndex(
            (x) => x.id === currentPlayingVideo.videoId,
          );
          if (
            mutableSceneData.pluginData.videos[index]?.metadata.duration !== dur
          ) {
            mutableSceneData.pluginData.videos[index]!.metadata.duration = dur;
          }
        }}
        onPlay={() => {
          pluginApi.awareness.setAwarenessStateData({ isLoading: false });
        }}
        onPause={() => {
          pluginApi.awareness.setAwarenessStateData({ isLoading: false });
        }}
        onBuffer={() => {
          pluginApi.awareness.setAwarenessStateData({ isLoading: true });
        }}
        onReady={() => {
          if (isPlaying) {
            pluginApi.awareness.setAwarenessStateData({ isLoading: true });
          }
          setReady(true);
        }}
        onError={(err, errorData) => {
          pluginApi.log.error({ err, errorData }, "Error on Video playback");
        }}
        onBufferEnd={() => setVideoSeek()}
        onEnded={() => setIsEnded(true)}
        url={currentVideoUrl}
        config={{ youtube: { playerVars: { controls: 0 } } }}
      />
      {isYouTube && isEnded && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "black",
          }}
        />
      )}
    </div>
  );
};

export default VideoPlayerRenderer;
