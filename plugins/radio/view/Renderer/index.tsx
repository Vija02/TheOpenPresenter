import { lazy } from "react";

import { SequenceFade, SequencePlaybackState } from "../../src/sequence";
import { Track } from "../../src/types";
import { usePluginAPI } from "../pluginApi";
import { usePlaylistPosition } from "../usePlaylistPosition";
import type { TrackRole } from "./TrackPlayer";

const RadioPlayer = lazy(() => import("./RadioPlayer"));
const TrackPlayer = lazy(() => import("./TrackPlayer"));

const MusicPlayerRenderer = () => {
  return (
    <>
      <RadioRenderer />
      <TrackRenderer />
    </>
  );
};

const RadioRenderer = () => {
  const pluginApi = usePluginAPI();
  const isPlaying = pluginApi.renderer.useData((x) => x.isPlaying);
  const url = pluginApi.renderer.useData((x) => x.url);

  const canPlay = pluginApi.audio.useCanPlay({ skipCheck: !isPlaying });

  if (!canPlay || !url) {
    return null;
  }
  return <RadioPlayer key={url} />;
};

type Layer = {
  track: Track;
  role: TrackRole;
  playbackState: SequencePlaybackState;
  fade: SequenceFade | null;
};

const TrackRenderer = () => {
  const {
    track,
    playbackState,
    fade,
    outgoing,
    outgoingTrack,
    upcoming,
    upcomingTrack,
  } = usePlaylistPosition();

  if (!track) {
    return null;
  }

  const layers: Layer[] = [{ track, role: "current", playbackState, fade }];
  if (outgoing && outgoingTrack) {
    layers.push({
      track: outgoingTrack,
      role: "outgoing",
      playbackState: outgoing.playbackState,
      fade: outgoing.fade,
    });
  }
  // Loaded paused and silent ahead of time, so it can start on cue
  if (
    upcoming &&
    upcomingTrack &&
    !layers.some((x) => x.track.id === upcomingTrack.id)
  ) {
    layers.push({
      track: upcomingTrack,
      role: "upcoming",
      playbackState: {
        // Its own uid, so starting for real seeks to the right spot
        uid: `upcoming:${playbackState.uid}`,
        isPlaying: false,
        seek: 0,
        startedAt: upcoming.startsAt,
        onFinishBehaviour: "pause",
      },
      fade: null,
    });
  }

  return layers
    .sort((a, b) => a.track.id.localeCompare(b.track.id))
    .map((layer) => <TrackPlayer key={layer.track.id} {...layer} />);
};

export default MusicPlayerRenderer;
