import {
  ResolvedSequence,
  SequenceAnchor,
  SequenceItem,
  SequenceRepeat,
  UniversalVideo,
  VideoPlaybackState,
  resolveSequence,
} from "@repo/video";
import { useResolvedSequence } from "@repo/video/client";
import { useCallback, useMemo } from "react";

import { PluginRendererData } from "../src/types";
import { usePluginAPI } from "./pluginApi";

type SequenceRendererData = Pick<
  PluginRendererData,
  "activeVideoId" | "videoStates" | "autoplay" | "repeatMode"
>;

/** Scenes from before repeat existed looped videos one at a time */
export const getRepeatMode = (
  rendererData: SequenceRendererData,
): SequenceRepeat => {
  if (rendererData.repeatMode) return rendererData.repeatMode;
  const activeVideoId = rendererData.activeVideoId;
  return activeVideoId &&
    rendererData.videoStates[activeVideoId]?.onFinishBehaviour === "loop"
    ? "one"
    : "off";
};

const getSequenceOptions = (rendererData: SequenceRendererData) =>
  ({
    // "one" is left to the players, since every video loops
    repeat: getRepeatMode(rendererData) === "all" ? "all" : "off",
  }) as const;

/**
 * With autoplay on, the videos play back to back, derived from the active
 * video's state plus the clock. See `@repo/video` sequence
 */
const getSequenceInput = (
  videos: UniversalVideo[],
  rendererData: SequenceRendererData,
) => {
  const activeVideoId = rendererData.activeVideoId;
  const state = activeVideoId ? rendererData.videoStates[activeVideoId] : null;

  const items: SequenceItem[] =
    rendererData.autoplay && state
      ? videos.map((x) => ({
          id: x.id,
          // A looping video plays until someone acts, so it never moves on
          duration:
            rendererData.videoStates[x.id]?.onFinishBehaviour === "loop"
              ? undefined
              : x.metadata.duration,
        }))
      : [];

  const anchor: SequenceAnchor = {
    itemId: activeVideoId,
    uid: state?.uid ?? "",
    isPlaying: state?.isPlaying ?? false,
    seek: state?.seek ?? 0,
    startedAt: state?.startedAt ?? 0,
  };

  return { items, anchor };
};

/** The video playing now and its state, where autoplay may have moved on */
const toCurrentVideo = (
  resolved: ResolvedSequence,
  rendererData: SequenceRendererData,
): { videoId: string | null; playbackState: VideoPlaybackState | null } => {
  const activeVideoId = rendererData.activeVideoId;
  // Autoplay is off or nothing is active, so it's just what's stored
  if (!resolved.itemId) {
    return {
      videoId: activeVideoId,
      playbackState: activeVideoId
        ? (rendererData.videoStates[activeVideoId] ?? null)
        : null,
    };
  }

  const stored = rendererData.videoStates[resolved.itemId];
  if (!stored) return { videoId: resolved.itemId, playbackState: null };

  const { uid, isPlaying, seek, startedAt } = resolved.playbackState;
  if (stored.uid === uid)
    return { videoId: resolved.itemId, playbackState: stored };

  return {
    videoId: resolved.itemId,
    playbackState: resolved.isEnded
      ? // Left playing at its end, so it reads as ended and play restarts it
        { ...stored, uid, isPlaying: true, seek: 1, startedAt }
      : { ...stored, uid, isPlaying, seek, startedAt },
  };
};

export const useVideoSequence = () => {
  const pluginApi = usePluginAPI();

  const videos = pluginApi.scene.useData((x) => x.pluginData.videos);
  const activeVideoId = pluginApi.renderer.useData((x) => x.activeVideoId);
  const videoStates = pluginApi.renderer.useData((x) => x.videoStates);
  const autoplay = pluginApi.renderer.useData((x) => x.autoplay) ?? false;
  const repeatMode = pluginApi.renderer.useData((x) => x.repeatMode);

  const rendererData = useMemo(
    () => ({ activeVideoId, videoStates, autoplay, repeatMode }),
    [activeVideoId, videoStates, autoplay, repeatMode],
  );
  const { items, anchor } = useMemo(
    () => getSequenceInput(videos, rendererData),
    [videos, rendererData],
  );
  const resolved = useResolvedSequence(
    items,
    anchor,
    getSequenceOptions(rendererData),
  );

  return useMemo(
    () => ({
      ...toCurrentVideo(resolved, rendererData),
      repeatMode: getRepeatMode(rendererData),
    }),
    [resolved, rendererData],
  );
};

/**
 * Stores where autoplay has got to, so the active video is the one playing.
 * Call before any action that changes playback or the list of videos
 */
export const useRebaseVideoSequence = () => {
  const pluginApi = usePluginAPI();
  const mutableSceneData = pluginApi.scene.useValtioData();
  const mutableRendererData = pluginApi.renderer.useValtioData();

  return useCallback(() => {
    const { items, anchor } = getSequenceInput(
      mutableSceneData.pluginData.videos,
      mutableRendererData,
    );
    const { videoId, playbackState } = toCurrentVideo(
      resolveSequence(items, anchor, getSequenceOptions(mutableRendererData)),
      mutableRendererData,
    );
    const stored = videoId ? mutableRendererData.videoStates[videoId] : null;
    if (!stored || !playbackState) return;

    mutableRendererData.activeVideoId = videoId;
    if (stored.uid !== playbackState.uid) {
      stored.uid = playbackState.uid;
      stored.isPlaying = playbackState.isPlaying;
      stored.seek = playbackState.seek;
      stored.startedAt = playbackState.startedAt;
    }
  }, [mutableRendererData, mutableSceneData]);
};
