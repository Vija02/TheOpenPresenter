import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { UniversalVideo, VideoPlaybackState } from "../../types";
import { usePluginAPI } from "../pluginApi";
import {
  computePlaybackState,
  useComputedPlaybackState,
} from "../useComputedPlaybackState";
import { useVideoUrl } from "./useVideoUrl";
import ReactPlayer from "react-player";
import { Config } from "react-player/types";

export type VideoPlayerProps = {
  video: UniversalVideo | null;
  /**
   * The playback state. Pass this from your Yjs state:
   * `pluginApi.renderer.useData((x) => x.videoState)`
   */
  playbackState: VideoPlaybackState;
  onDurationChange?: (duration: number) => void;
  onAwarenessLoadingChange?: (isLoading: boolean) => void;
  onError?: (error: Error, data?: unknown) => void;
  onEnded?: () => void;
  config?: Config;
  forceLoop?: boolean;
};

export const VideoPlayer = ({
  video,
  playbackState,
  onDurationChange,
  onAwarenessLoadingChange,
  onError,
  onEnded,
  config,
  forceLoop,
}: VideoPlayerProps) => {
  const pluginApi = usePluginAPI();

  const videoDuration = video?.metadata.duration;
  const volume = playbackState.volume ?? 1;
  const muted = playbackState.muted ?? false;

  const { isPlaying, isEnded } = useComputedPlaybackState(
    playbackState,
    videoDuration,
  );

  const canPlay = pluginApi.audio.useCanPlay({
    skipCheck: !isPlaying || muted,
  });

  const [ready, setReady] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  const hasInitialSeekRef = useRef(false);

  const { videoUrl, isYouTube } = useVideoUrl(video);

  useEffect(() => {
    if (isEnded) {
      onEnded?.();
    }
  }, [isEnded, onEnded]);

  const setVideoSeek = useCallback(
    (manual?: boolean) => {
      // If forceLoop is enabled and we've already done the initial seek, skip further seeking
      if (forceLoop && hasInitialSeekRef.current) {
        return;
      }

      if (ready && playbackState && videoDuration) {
        const {
          isPlaying: computedPlaying,
          currentTimeSeconds: computerCurrentTimeSeconds,
        } = computePlaybackState(playbackState, videoDuration);
        const targetTimeSeconds = computerCurrentTimeSeconds;
        const currentTime = ref.current?.currentTime ?? 0;

        // 2 second tolerance
        const tolerance = 2;
        if (manual || Math.abs(currentTime - targetTimeSeconds) > tolerance) {
          if (ref.current) ref.current.currentTime = targetTimeSeconds;
          if (computedPlaying) ref.current?.play();
          hasInitialSeekRef.current = true;
        }
      }
    },
    [playbackState, videoDuration, ready, forceLoop],
  );
  const uid = useMemo(() => playbackState.uid, [playbackState.uid]);

  // Handle seek sync when uid changes (user seeks or plays)
  useEffect(() => {
    if (ready && videoDuration) {
      setVideoSeek(true);
    }
  }, [videoDuration, ready, setVideoSeek, uid]);

  if (!videoUrl || !playbackState) {
    return null;
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <ReactPlayer
        ref={ref}
        height="100%"
        width="100%"
        muted={muted || !canPlay}
        volume={volume}
        playing={isPlaying}
        loop={forceLoop}
        onDurationChange={() => {
          const player = ref.current;
          if (!player) return;

          onDurationChange?.(player.duration);
        }}
        onPlay={() => {
          onAwarenessLoadingChange?.(false);
        }}
        onPause={() => {
          onAwarenessLoadingChange?.(false);
        }}
        onWaiting={() => {
          onAwarenessLoadingChange?.(true);
        }}
        onReady={() => {
          if (isPlaying) {
            onAwarenessLoadingChange?.(false);
          }
          setReady(true);
        }}
        onError={(err: unknown, data?: unknown) => {
          console.error(err, data);
          onError?.(err instanceof Error ? err : new Error(String(err)), data);
        }}
        onPlaying={() => {
          setVideoSeek();
          onAwarenessLoadingChange?.(false);
        }}
        src={videoUrl}
        config={{
          ...config,
          youtube: {
            referrerpolicy: "strict-origin-when-cross-origin",
            cc_load_policy: 0,
            ...config?.youtube,
          },
        }}
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
