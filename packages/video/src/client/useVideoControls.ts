import { useMemo, useRef } from "react";

import { VideoPlaybackState } from "../types";
import { computePlaybackState } from "./useComputedPlaybackState";

export type VideoControls = {
  play: () => void;
  pause: () => void;
  seek: (position: number, resumePlayback?: boolean) => void;
  restart: (autoPlay?: boolean) => void;
  setVolume: (volume: number) => void;
  stop: () => void;
  toggleLoop: () => void;
  /** Call when starting to seek (e.g., scrubber drag start). Pauses playback and stores state. */
  startSeeking: (position: number) => void;
  /** Call during seeking (e.g., scrubber drag). Updates position without changing play state. */
  updateSeeking: (position: number) => void;
  /** Call when seeking ends (e.g., scrubber drag end). Restores playback if it was playing before. */
  endSeeking: (position: number) => void;
};

export const useVideoControls = (
  getState: () => VideoPlaybackState | null,
  mutableVideoState: VideoPlaybackState,
  duration: number,
): VideoControls => {
  // Store whether we were playing before seeking started
  const wasPlayingBeforeSeekRef = useRef<boolean>(false);

  return useMemo(() => {
    return {
      play: () => {
        // If video has ended, restart from beginning
        if (duration) {
          const { isEnded } = computePlaybackState(mutableVideoState, duration);
          if (isEnded) {
            mutableVideoState.seek = 0;
          }
        }

        mutableVideoState.uid = Math.random().toString();
        mutableVideoState.isPlaying = true;
        mutableVideoState.startedAt = Date.now();
      },

      pause: () => {
        const state = getState();
        if (!state) return;

        const currentSeek = duration
          ? computePlaybackState(state, duration).currentSeek
          : state.seek;

        mutableVideoState.uid = Math.random().toString();
        mutableVideoState.isPlaying = false;
        mutableVideoState.seek = currentSeek;
        mutableVideoState.startedAt = Date.now();
      },

      seek: (position: number, resumePlayback = false) => {
        mutableVideoState.uid = Math.random().toString();
        mutableVideoState.seek = position;
        mutableVideoState.startedAt = Date.now();
        if (resumePlayback) {
          mutableVideoState.isPlaying = true;
        }
      },

      restart: (autoPlay = true) => {
        mutableVideoState.uid = Math.random().toString();
        mutableVideoState.seek = 0;
        mutableVideoState.startedAt = Date.now();
        mutableVideoState.isPlaying = autoPlay;
      },

      setVolume: (volume: number) => {
        mutableVideoState.volume = Math.max(0, Math.min(1, volume));
      },

      stop: () => {
        mutableVideoState.uid = Math.random().toString();
        mutableVideoState.isPlaying = false;
        mutableVideoState.seek = 0;
        mutableVideoState.startedAt = Date.now();
      },

      toggleLoop: () => {
        // When toggling loop mode, we need to persist the current playback position
        // to prevent the video from ending immediately when switching from loop to pause
        if (mutableVideoState.isPlaying && duration) {
          const { currentSeek } = computePlaybackState(
            mutableVideoState,
            duration,
          );
          mutableVideoState.seek = currentSeek;
          mutableVideoState.startedAt = Date.now();
        }

        mutableVideoState.onFinishBehaviour =
          mutableVideoState.onFinishBehaviour === "loop" ? "pause" : "loop";
      },

      startSeeking: (position: number) => {
        // Remember if we were playing before seeking
        wasPlayingBeforeSeekRef.current = mutableVideoState.isPlaying;

        mutableVideoState.uid = Math.random().toString();
        mutableVideoState.seek = position;
        mutableVideoState.isPlaying = false;
        mutableVideoState.startedAt = Date.now();
      },

      updateSeeking: (position: number) => {
        mutableVideoState.uid = Math.random().toString();
        mutableVideoState.seek = position;
        mutableVideoState.isPlaying = false;
        mutableVideoState.startedAt = Date.now();
      },

      endSeeking: (position: number) => {
        const shouldResume = wasPlayingBeforeSeekRef.current;
        wasPlayingBeforeSeekRef.current = false;

        mutableVideoState.uid = Math.random().toString();
        mutableVideoState.seek = position;
        mutableVideoState.isPlaying = shouldResume;
        mutableVideoState.startedAt = Date.now();
      },
    };
  }, [getState, mutableVideoState, duration]);
};
