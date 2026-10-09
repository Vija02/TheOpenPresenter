import {
  SequenceRepeat,
  UniversalVideo,
  getNextItemId,
  getPreviousItemId,
} from "@repo/video";
import { computePlaybackState } from "@repo/video/client";
import { useMemo } from "react";

import { usePluginAPI } from "../pluginApi";
import { getRepeatMode, useRebaseVideoSequence } from "../useVideoSequence";

/** Going back this far into a video restarts it rather than skipping back */
const RESTART_THRESHOLD_SECONDS = 3;

/** Every action rebases first, since autoplay may have moved on */
export const useVideoPlayerControls = () => {
  const pluginApi = usePluginAPI();
  const mutableSceneData = pluginApi.scene.useValtioData();
  const mutableRendererData = pluginApi.renderer.useValtioData();
  const setRenderCurrentScene = pluginApi.renderer.setRenderCurrentScene;
  const rebase = useRebaseVideoSequence();

  return useMemo(() => {
    const getVideos = () => mutableSceneData.pluginData.videos;
    const getDuration = (videoId: string) =>
      getVideos().find((x) => x.id === videoId)?.metadata.duration ?? 0;
    const newUid = () => Math.random().toString();

    const computeState = (videoId: string) => {
      const state = mutableRendererData.videoStates[videoId];
      return state ? computePlaybackState(state, getDuration(videoId)) : null;
    };

    const pauseVideo = (videoId: string) => {
      const state = mutableRendererData.videoStates[videoId];
      const computed = computeState(videoId);
      if (!state || !computed) return;

      state.uid = newUid();
      state.isPlaying = false;
      state.seek = computed.currentSeek;
      state.startedAt = Date.now();
    };

    const playVideo = (videoId: string, fromStart = false) => {
      const state = mutableRendererData.videoStates[videoId];
      const computed = computeState(videoId);
      if (!state || !computed) return;

      // Only one plays at a time
      for (const [otherId, other] of Object.entries(
        mutableRendererData.videoStates,
      )) {
        if (otherId !== videoId && other.isPlaying) pauseVideo(otherId);
      }

      const atEnd = computed.isEnded || computed.currentSeek >= 0.999;
      mutableRendererData.activeVideoId = videoId;
      state.uid = newUid();
      state.isPlaying = true;
      state.seek = fromStart || atEnd ? 0 : computed.currentSeek;
      state.startedAt = Date.now();
      setRenderCurrentScene();
    };

    const isPlaying = (videoId: string) =>
      mutableRendererData.activeVideoId === videoId &&
      !!computeState(videoId)?.isPlaying;

    const toggleVideo = (videoId: string) => {
      rebase();
      if (isPlaying(videoId)) {
        pauseVideo(videoId);
      } else {
        playVideo(videoId);
      }
    };

    const togglePlayback = () => {
      rebase();
      const videoId =
        mutableRendererData.activeVideoId ?? getVideos()[0]?.id ?? null;
      if (videoId) toggleVideo(videoId);
    };

    const next = () => {
      rebase();
      // Skipping is explicit, so it always wraps around
      const nextVideoId = getNextItemId(
        getVideos(),
        mutableRendererData.activeVideoId,
        "all",
      );
      if (nextVideoId) playVideo(nextVideoId, true);
    };

    const previous = () => {
      rebase();
      const activeVideoId = mutableRendererData.activeVideoId;
      const currentTimeSeconds = activeVideoId
        ? (computeState(activeVideoId)?.currentTimeSeconds ?? 0)
        : 0;
      const previousVideoId =
        currentTimeSeconds > RESTART_THRESHOLD_SECONDS
          ? activeVideoId
          : getPreviousItemId(getVideos(), activeVideoId);
      if (previousVideoId) playVideo(previousVideoId, true);
    };

    const seekActive = (seek: number, isPlaying: boolean) => {
      const activeVideoId = mutableRendererData.activeVideoId;
      const state = activeVideoId
        ? mutableRendererData.videoStates[activeVideoId]
        : null;
      if (!state) return;

      state.uid = newUid();
      state.seek = seek;
      state.isPlaying = isPlaying;
      state.startedAt = Date.now();
    };

    let wasPlayingBeforeSeek = false;
    const startSeeking = (seek: number) => {
      rebase();
      const activeVideoId = mutableRendererData.activeVideoId;
      wasPlayingBeforeSeek = !!activeVideoId && isPlaying(activeVideoId);
      seekActive(seek, false);
    };
    const updateSeeking = (seek: number) => {
      seekActive(seek, false);
    };
    const endSeeking = (seek: number) => {
      seekActive(seek, wasPlayingBeforeSeek);
      wasPlayingBeforeSeek = false;
    };

    const setRepeatMode = (repeatMode: SequenceRepeat) => {
      rebase();
      mutableRendererData.repeatMode = repeatMode;
      // Going round the list means moving through it
      if (repeatMode === "all") mutableRendererData.autoplay = true;

      const onFinishBehaviour = repeatMode === "one" ? "loop" : "pause";
      for (const [videoId, state] of Object.entries(
        mutableRendererData.videoStates,
      )) {
        if (state.onFinishBehaviour === onFinishBehaviour) continue;
        // Pin the position, so a loop switched off doesn't end it straight away
        if (state.isPlaying) {
          state.seek = computeState(videoId)?.currentSeek ?? state.seek;
          state.startedAt = Date.now();
        }
        state.onFinishBehaviour = onFinishBehaviour;
      }
    };

    const setAutoplay = (enabled: boolean) => {
      rebase();
      mutableRendererData.autoplay = enabled;
      if (!enabled && getRepeatMode(mutableRendererData) === "all") {
        mutableRendererData.repeatMode = "off";
      }
    };

    const addVideos = (videos: UniversalVideo[]) => {
      // Otherwise autoplay could pick up partway into the new videos
      rebase();
      getVideos().push(...videos);
    };

    const removeVideo = (videoId: string) => {
      rebase();
      const index = getVideos().findIndex((x) => x.id === videoId);
      if (index !== -1) getVideos().splice(index, 1);

      delete mutableRendererData.videoStates[videoId];
      if (mutableRendererData.activeVideoId === videoId) {
        mutableRendererData.activeVideoId = null;
      }
    };

    const moveVideo = (from: number, to: number) => {
      const videos = getVideos();
      if (to < 0 || to >= videos.length) return;

      rebase();
      const [video] = videos.splice(from, 1);
      // Re-inserting the removed proxy isn't allowed, so we insert a copy
      if (video) videos.splice(to, 0, JSON.parse(JSON.stringify(video)));
    };

    return {
      toggleVideo,
      togglePlayback,
      next,
      previous,
      startSeeking,
      updateSeeking,
      endSeeking,
      setRepeatMode,
      setAutoplay,
      addVideos,
      removeVideo,
      moveVideo,
    };
  }, [mutableRendererData, mutableSceneData, rebase, setRenderCurrentScene]);
};

export type VideoPlayerControls = ReturnType<typeof useVideoPlayerControls>;
