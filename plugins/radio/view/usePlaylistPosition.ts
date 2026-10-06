import { createVideoPlaybackState } from "@repo/video";
import { useMemo } from "react";

import { SequenceAnchor, SequenceItem } from "../src/sequence";
import { usePluginAPI } from "./pluginApi";
import { useResolvedSequence } from "./sequence/useResolvedSequence";

const emptyTrackState = createVideoPlaybackState();

export const usePlaylistSequenceInput = () => {
  const pluginApi = usePluginAPI();

  const tracks = pluginApi.scene.useData((x) => x.pluginData.tracks);
  const activeTrackId = pluginApi.renderer.useData((x) => x.activeTrackId);
  const trackState =
    pluginApi.renderer.useData((x) => x.trackState) ?? emptyTrackState;
  const repeatMode = pluginApi.renderer.useData((x) => x.repeatMode) ?? "off";
  const crossfadeSeconds =
    pluginApi.renderer.useData((x) => x.crossfadeSeconds) ?? 0;
  const fadingOutTrack =
    pluginApi.renderer.useData((x) => x.fadingOutTrack) ?? null;

  const items: SequenceItem[] = useMemo(
    () =>
      (tracks ?? []).map((x) => ({ id: x.id, duration: x.metadata.duration })),
    [tracks],
  );

  const anchor: SequenceAnchor = useMemo(
    () => ({
      itemId: activeTrackId ?? null,
      uid: trackState.uid,
      isPlaying: trackState.isPlaying,
      seek: trackState.seek,
      startedAt: trackState.startedAt,
      outgoing: fadingOutTrack,
    }),
    [
      activeTrackId,
      trackState.uid,
      trackState.isPlaying,
      trackState.seek,
      trackState.startedAt,
      fadingOutTrack,
    ],
  );

  return {
    tracks: tracks ?? [],
    items,
    anchor,
    repeatMode,
    crossfadeSeconds,
  };
};

export const usePlaylistPosition = () => {
  const { tracks, items, anchor, repeatMode, crossfadeSeconds } =
    usePlaylistSequenceInput();
  const resolved = useResolvedSequence(items, anchor, {
    repeat: repeatMode,
    crossfade: crossfadeSeconds,
  });

  const track = useMemo(
    () => tracks.find((x) => x.id === resolved.itemId) ?? null,
    [resolved.itemId, tracks],
  );

  const findTrack = (id: string | undefined) =>
    tracks.find((x) => x.id === id) ?? null;

  return {
    ...resolved,
    tracks,
    track,
    outgoingTrack: findTrack(resolved.outgoing?.itemId),
    upcomingTrack: findTrack(resolved.upcoming?.itemId),
    repeatMode,
    crossfadeSeconds,
  };
};
