import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { UniversalVideo, VideoPlaybackState } from "../../types";
import { usePluginAPI } from "../pluginApi";
import {
  computePlaybackState,
  useComputedPlaybackState,
} from "../useComputedPlaybackState";
import { useVideoUrl } from "./useVideoUrl";
import { getWarmedStartLevel } from "../preload/videoPreload";
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
  onLoadedChange?: (loaded: boolean) => void;
  onError?: (error: Error, data?: unknown) => void;
  onEnded?: () => void;
  config?: Config;
  forceLoop?: boolean;
  preload?: "none" | "metadata" | "auto";
};

export const VideoPlayer = ({
  video,
  playbackState,
  onDurationChange,
  onAwarenessLoadingChange,
  onLoadedChange,
  onError,
  onEnded,
  config,
  forceLoop,
  preload = "auto",
}: VideoPlayerProps) => {
  const pluginApi = usePluginAPI();

  const videoDuration = useMemo(
    () => video?.metadata.duration,
    [video?.metadata.duration],
  );
  const volume = useMemo(
    () => playbackState.volume ?? 1,
    [playbackState.volume],
  );
  const muted = useMemo(
    () => playbackState.muted ?? false,
    [playbackState.muted],
  );

  const { isPlaying, isEnded } = useComputedPlaybackState(
    playbackState,
    videoDuration,
  );

  const canPlay = pluginApi.audio.useCanPlay({
    skipCheck: !isPlaying || muted,
  });

  const ref = useRef<HTMLVideoElement>(null);
  const hasInitialSeekRef = useRef(false);

  const { videoUrl, isYouTube } = useVideoUrl(video);

  // Ready belongs to one source, so a new source waits for its own ready
  const [readyUrl, setReadyUrl] = useState<string | null>(null);
  const ready = readyUrl !== null && readyUrl === videoUrl;

  const onAwarenessLoadingChangeRef = useRef(onAwarenessLoadingChange);
  onAwarenessLoadingChangeRef.current = onAwarenessLoadingChange;

  const [loaded, setLoaded] = useState(false);

  const warmedStartLevel = useMemo(
    () => getWarmedStartLevel(videoUrl),
    [videoUrl],
  );

  // A new source has its own load to wait out, so this starts over.
  useEffect(() => {
    setLoaded(false);
    // The old load is dropped without an event that clears the loading state
    return () => onAwarenessLoadingChangeRef.current?.(false);
  }, [videoUrl]);

  // A load that aborts a pending play() pauses without a pause event
  useEffect(() => {
    if (!isPlaying) onAwarenessLoadingChangeRef.current?.(false);
  }, [isPlaying]);

  useEffect(() => {
    onLoadedChange?.(loaded);
  }, [loaded, onLoadedChange]);

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

      if (ready && playbackState.uid && videoDuration) {
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
          if (computedPlaying) {
            ref.current?.play().catch((err: unknown) => {
              // A new load aborts this play. Its own ready plays it again
              if (err instanceof DOMException && err.name === "AbortError") {
                return;
              }
              throw err;
            });
          }
          hasInitialSeekRef.current = true;
        }
      }
    },
    [playbackState.uid, videoDuration, ready, forceLoop],
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
        playbackRate={playbackState.playbackRate ?? 1}
        playing={isPlaying}
        loop={forceLoop}
        preload={preload}
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
          setReadyUrl(videoUrl);
        }}
        onLoadedData={() => {
          setLoaded(true);
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
          hls: {
            ...(warmedStartLevel === null
              ? {}
              : { startLevel: warmedStartLevel }),
            ...config?.hls,
          },
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
