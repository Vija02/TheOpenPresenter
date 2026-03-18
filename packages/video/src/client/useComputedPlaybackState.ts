import { useEffect, useMemo, useState } from "react";
import { VideoPlaybackState } from "../types";

export type ComputedPlaybackState = {
  isPlaying: boolean;
  currentSeek: number;
  isEnded: boolean;
  currentTimeSeconds: number;
};

export const computePlaybackState = (
  playbackState: VideoPlaybackState,
  videoDuration: number,
  currentTime: number = Date.now(),
): ComputedPlaybackState => {
  if (!playbackState.isPlaying || !videoDuration) {
    return {
      isPlaying: false,
      currentSeek: playbackState.seek,
      isEnded: false,
      currentTimeSeconds: playbackState.seek * videoDuration,
    };
  }

  const elapsedSeconds = (currentTime - playbackState.startedAt) / 1000;
  const startedAtSeconds = playbackState.seek * videoDuration;
  const totalElapsedSeconds = elapsedSeconds + startedAtSeconds;

  if (playbackState.onFinishBehaviour === "loop") {
    const loopedSeconds = totalElapsedSeconds % videoDuration;
    const loopedSeek = loopedSeconds / videoDuration;

    return {
      isPlaying: true,
      currentSeek: Math.max(0, Math.min(0.999999, loopedSeek)),
      isEnded: false,
      currentTimeSeconds: loopedSeconds,
    };
  } else {
    if (totalElapsedSeconds >= videoDuration) {
      return {
        isPlaying: false,
        currentSeek: 0.999999,
        isEnded: true,
        currentTimeSeconds: videoDuration,
      };
    }

    const currentSeek = totalElapsedSeconds / videoDuration;
    return {
      isPlaying: true,
      currentSeek: Math.max(0, Math.min(0.999999, currentSeek)),
      isEnded: false,
      currentTimeSeconds: totalElapsedSeconds,
    };
  }
};

export const useComputedPlaybackState = (
  playbackState: VideoPlaybackState | null,
  videoDuration: number | undefined,
  updateInterval: number = 100,
): ComputedPlaybackState => {
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    if (!playbackState?.isPlaying) {
      return;
    }

    setCurrentTime(Date.now());

    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, updateInterval);

    return () => clearInterval(interval);
  }, [playbackState?.isPlaying, updateInterval]);

  return useMemo(() => {
    if (!playbackState || !videoDuration) {
      return {
        isPlaying: false,
        currentSeek: 0,
        isEnded: false,
        currentTimeSeconds: 0,
      };
    }

    return computePlaybackState(playbackState, videoDuration, currentTime);
  }, [playbackState, videoDuration, currentTime]);
};
