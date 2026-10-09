import { SequenceFade, SequencePlaybackState } from "@repo/video";
import { useVideoPreload } from "@repo/video/client";
import { lazy } from "react";

import { Track } from "../../src/types";
import { usePluginAPI } from "../pluginApi";
import { isTrackReady, trackVideo } from "../trackHelpers";
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
    tracks,
    track,
    isEnded,
    playbackState,
    fade,
    outgoing,
    outgoingTrack,
    upcoming,
    upcomingTrack,
  } = usePlaylistPosition();

  // The start of each library track, so any of them begins at once.
  useVideoPreload(
    [track, upcomingTrack].map((x) => x && trackVideo(x)),
    "eager",
  );
  useVideoPreload(
    tracks.filter((x) => x.type === "audio").map(trackVideo),
    "background",
  );

  const layers: Layer[] = [];
  if (track) {
    layers.push({ track, role: "current", playbackState, fade });
  }
  // Play starts the first track from here, so it's ready and waiting. This
  // also loads the player itself, and YouTube can't be warmed any other way
  const firstTrack = tracks[0];
  if (
    (!track || isEnded) &&
    firstTrack &&
    isTrackReady(firstTrack) &&
    firstTrack.id !== track?.id
  ) {
    layers.push({
      track: firstTrack,
      role: "upcoming",
      playbackState: {
        uid: "upcoming:first",
        isPlaying: false,
        seek: 0,
        startedAt: 0,
        onFinishBehaviour: "pause",
      },
      fade: null,
    });
  }
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
    track &&
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
