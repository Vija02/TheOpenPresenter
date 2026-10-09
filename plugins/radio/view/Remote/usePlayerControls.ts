import {
  ResolvedSequence,
  SequenceAnchor,
  getNextItemId,
  getPreviousItemId,
  rebaseAnchor,
  resolveSequence,
} from "@repo/video";
import { useMemo } from "react";

import { RepeatMode, Track } from "../../src/types";
import { usePluginAPI } from "../pluginApi";
import { toSequenceItems } from "../usePlaylistPosition";

/** Going back this far into a track restarts it rather than skipping back */
const RESTART_THRESHOLD_SECONDS = 3;

/** Every user action rebases first, see ../../src/sequence */
export const usePlayerControls = () => {
  const pluginApi = usePluginAPI();
  const mutableSceneData = pluginApi.scene.useValtioData();
  const mutableRendererData = pluginApi.renderer.useValtioData();

  return useMemo(() => {
    const getTracks = () => mutableSceneData.pluginData.tracks;

    const resolveNow = (now: number): ResolvedSequence => {
      const state = mutableRendererData.trackState;
      return resolveSequence(
        toSequenceItems(
          getTracks(),
          mutableRendererData.activeTrackId ?? null,
          mutableRendererData.autoplay ?? true,
        ),
        {
          itemId: mutableRendererData.activeTrackId ?? null,
          uid: state.uid,
          isPlaying: state.isPlaying,
          seek: state.seek,
          startedAt: state.startedAt,
          outgoing: mutableRendererData.fadingOutTrack ?? null,
        },
        {
          repeat: mutableRendererData.repeatMode ?? "off",
          crossfade: mutableRendererData.crossfadeSeconds ?? 0,
        },
        now,
      );
    };

    const newUid = () => Math.random().toString();

    const writeAnchor = (anchor: SequenceAnchor) => {
      mutableRendererData.activeTrackId = anchor.itemId;

      const state = mutableRendererData.trackState;
      state.uid = anchor.uid;
      state.isPlaying = anchor.isPlaying;
      state.seek = anchor.seek;
      state.startedAt = anchor.startedAt;
      // A copy, since it may be a snapshot of what's stored
      mutableRendererData.fadingOutTrack = anchor.outgoing
        ? JSON.parse(JSON.stringify(anchor.outgoing))
        : null;
    };

    // Overrides make playback jump, so they get a fresh uid and cut any fade
    const rebase = (
      overrides?: Partial<Omit<SequenceAnchor, "uid" | "outgoing">>,
    ) => {
      const now = Date.now();
      const resolved = resolveNow(now);
      if (resolved.itemId) {
        writeAnchor({
          ...rebaseAnchor(resolved, now),
          ...overrides,
          ...(overrides ? { uid: newUid(), outgoing: null } : {}),
        });
      }
      return resolved;
    };

    const startTrack = (trackId: string) => {
      mutableRendererData.isPlaying = false;
      writeAnchor({
        itemId: trackId,
        uid: newUid(),
        isPlaying: true,
        seek: 0,
        startedAt: Date.now(),
        outgoing: null,
      });
    };

    const pauseTrack = () => {
      if (resolveNow(Date.now()).isPlaying) rebase({ isPlaying: false });
    };

    const resumeTrack = () => {
      const resolved = resolveNow(Date.now());
      if (!resolved.itemId) return;

      // A finished playlist starts again from the top, a lone track from its start
      if (resolved.isEnded) {
        const trackId =
          (mutableRendererData.autoplay ?? true)
            ? getTracks()[0]?.id
            : resolved.itemId;
        if (trackId) startTrack(trackId);
        return;
      }

      mutableRendererData.isPlaying = false;
      rebase({ isPlaying: true });
    };

    const toggleTrack = (trackId: string) => {
      const resolved = resolveNow(Date.now());
      if (resolved.itemId !== trackId || resolved.isEnded) {
        startTrack(trackId);
      } else if (resolved.isPlaying) {
        pauseTrack();
      } else {
        resumeTrack();
      }
    };

    const next = () => {
      const resolved = resolveNow(Date.now());
      // Skipping is explicit, so it always wraps around
      const nextTrackId = getNextItemId(getTracks(), resolved.itemId, "all");
      if (nextTrackId) startTrack(nextTrackId);
    };

    const previous = () => {
      const resolved = resolveNow(Date.now());
      const previousTrackId =
        resolved.currentTimeSeconds > RESTART_THRESHOLD_SECONDS
          ? resolved.itemId
          : getPreviousItemId(getTracks(), resolved.itemId);
      if (previousTrackId) startTrack(previousTrackId);
    };

    let wasPlayingBeforeSeek = false;
    const startSeeking = (seek: number) => {
      const resolved = resolveNow(Date.now());
      wasPlayingBeforeSeek = resolved.isPlaying;
      rebase({ isPlaying: false, seek });
    };
    const updateSeeking = (seek: number) => {
      rebase({ isPlaying: false, seek });
    };
    const endSeeking = (seek: number) => {
      rebase({ isPlaying: wasPlayingBeforeSeek, seek });
      wasPlayingBeforeSeek = false;
    };

    const setRepeatMode = (repeatMode: RepeatMode) => {
      rebase();
      mutableRendererData.repeatMode = repeatMode;
      if (repeatMode === "all") mutableRendererData.autoplay = true;
    };

    const setAutoplay = (enabled: boolean) => {
      rebase();
      mutableRendererData.autoplay = enabled;
      if (!enabled) {
        if (mutableRendererData.repeatMode === "all") {
          mutableRendererData.repeatMode = "off";
        }
        mutableRendererData.crossfadeSeconds = 0;
      }
    };

    const setCrossfade = (seconds: number) => {
      rebase();
      mutableRendererData.crossfadeSeconds = seconds;
      if (seconds > 0) mutableRendererData.autoplay = true;
    };

    const addTracks = (tracks: Track[]) => {
      // Otherwise a finished playlist would pick up partway into the new tracks
      rebase();
      getTracks().push(...tracks);
    };

    const removeTrack = (trackId: string) => {
      const resolved = rebase();
      if (resolved.itemId === trackId) {
        mutableRendererData.activeTrackId = null;
        mutableRendererData.trackState.uid = newUid();
        mutableRendererData.trackState.isPlaying = false;
      }

      const index = getTracks().findIndex((x) => x.id === trackId);
      if (index !== -1) getTracks().splice(index, 1);
    };

    const moveTrack = (from: number, to: number) => {
      const tracks = getTracks();
      if (to < 0 || to >= tracks.length) return;

      rebase();
      const [track] = tracks.splice(from, 1);
      // Re-inserting the removed proxy isn't allowed, so we insert a copy
      if (track) tracks.splice(to, 0, JSON.parse(JSON.stringify(track)));
    };

    const playRadio = (url: string) => {
      pauseTrack();
      mutableRendererData.url = url;
      mutableRendererData.isPlaying = true;
    };

    const stopRadio = () => {
      mutableRendererData.isPlaying = false;
    };

    const togglePlayback = () => {
      const resolved = resolveNow(Date.now());

      if (mutableRendererData.isPlaying) {
        stopRadio();
      } else if (resolved.itemId) {
        toggleTrack(resolved.itemId);
      } else if (mutableRendererData.url) {
        playRadio(mutableRendererData.url);
      } else {
        const firstTrack = getTracks()[0];
        if (firstTrack) startTrack(firstTrack.id);
      }
    };

    return {
      startTrack,
      toggleTrack,
      pauseTrack,
      next,
      previous,
      startSeeking,
      updateSeeking,
      endSeeking,
      setRepeatMode,
      setAutoplay,
      setCrossfade,
      addTracks,
      removeTrack,
      moveTrack,
      playRadio,
      stopRadio,
      togglePlayback,
    };
  }, [mutableRendererData, mutableSceneData]);
};

export type PlayerControls = ReturnType<typeof usePlayerControls>;
