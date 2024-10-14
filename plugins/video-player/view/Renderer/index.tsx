import canAutoPlay from "can-autoplay";
import { useEffect, useRef, useState } from "react";
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

  const [canPlay, setCanPlay] = useState(false);

  useEffect(() => {
    const check = async () => {
      const res = await canAutoPlay.audio({ inline: true });
      if (res.result) {
        setCanPlay(true);
      } else {
        setTimeout(check, 1000);
      }
    };

    check();
  }, []);

  const ref = useRef<ReactPlayer>(null);

  const videos = pluginApi.scene.useData((x) => x.pluginData.videos);
  const isPlaying = pluginApi.renderer.useData((x) => x.isPlaying);
  const currentPlayingVideo = pluginApi.renderer.useData(
    (x) => x.currentPlayingVideo!,
  );
  const volume = pluginApi.renderer.useData((x) => x.volume);

  const mutableSceneData = pluginApi.scene.useValtioData();

  const currentVideo = videos.find(
    (vid) => vid.id === currentPlayingVideo.videoId,
  );

  // Handle on the go seeking
  useEffect(() => {
    if (
      currentPlayingVideo.videoId &&
      isPlaying &&
      currentPlayingVideo.playFrom
    ) {
      const seek = calculateActualSeek(
        currentPlayingVideo,
        currentVideo?.metadata.duration ?? 0,
      );
      ref.current?.seekTo(seek);
    }
  }, [currentPlayingVideo, currentVideo?.metadata.duration, isPlaying]);

  return (
    <ReactPlayer
      ref={ref}
      key={currentPlayingVideo.videoId}
      height="100%"
      width="100%"
      muted={!canPlay}
      volume={volume}
      playing={isPlaying}
      // TODO: Get this earlier
      onDuration={(dur) => {
        mutableSceneData.pluginData.videos[
          mutableSceneData.pluginData.videos.findIndex(
            (x) => x.id === currentPlayingVideo.videoId,
          )
        ]!.metadata.duration = dur;
      }}
      onStart={() => {
        if (currentPlayingVideo.playFrom) {
          const seek = calculateActualSeek(
            currentPlayingVideo,
            currentVideo?.metadata.duration ?? 0,
          );
          ref.current?.seekTo(seek);
        }
      }}
      url={currentVideo?.url}
      config={{ youtube: { playerVars: { controls: 0 } } }}
    />
  );
};

export default VideoPlayerRenderer;
