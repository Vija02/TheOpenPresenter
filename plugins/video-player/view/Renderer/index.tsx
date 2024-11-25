import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactPlayer from "react-player/lazy";

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

  const canPlay = pluginApi.audio.useCanPlay();

  const [ready, setReady] = useState(false);

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

  const setVideoSeek = useCallback(() => {
    if (currentPlayingVideo.playFrom && ready) {
      const duration = currentVideo?.metadata.duration ?? 0;

      const targetSeek = calculateActualSeek(currentPlayingVideo, duration);

      const currentTime = ref.current?.getCurrentTime();
      const currentSeek = (currentTime ?? 0) / duration;

      // 2 second tolerance
      const tolerance = 2 / duration;
      if (Math.abs(currentSeek - targetSeek) > tolerance) {
        ref.current?.seekTo(targetSeek);
      }
    }
  }, [currentPlayingVideo, currentVideo?.metadata.duration, ready]);

  // Handle on the go seeking
  useEffect(() => {
    if (
      currentPlayingVideo.videoId &&
      isPlaying &&
      ready &&
      currentPlayingVideo.playFrom &&
      currentVideo?.metadata.duration
    ) {
      setVideoSeek();
    }
  }, [
    currentPlayingVideo,
    currentVideo?.metadata.duration,
    isPlaying,
    ready,
    setVideoSeek,
  ]);

  return (
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
      onReady={() => {
        setReady(true);
      }}
      onBufferEnd={setVideoSeek}
      url={currentVideo?.url}
      config={{ youtube: { playerVars: { controls: 0 } } }}
    />
  );
};

export default VideoPlayerRenderer;
