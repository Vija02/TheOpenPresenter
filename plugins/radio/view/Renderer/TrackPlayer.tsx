import {
  SequenceFade,
  SequencePlaybackState,
  volumeToAmplitude,
} from "@repo/video";
import { VideoPlayer } from "@repo/video/client";
import { useMemo } from "react";

import { Track } from "../../src/types";
import { usePluginAPI } from "../pluginApi";
import { trackVideo } from "../trackHelpers";
import { useFadeGain } from "./useFadeGain";

// YouTube needs a real iframe to play, so we keep it on the page but unseen
const hiddenStyle: React.CSSProperties = {
  position: "absolute",
  width: 320,
  height: 180,
  opacity: 0,
  pointerEvents: "none",
  zIndex: -1,
};

export type TrackRole = "current" | "outgoing" | "upcoming";

const TrackPlayer = ({
  track,
  playbackState,
  role,
  fade,
}: {
  track: Track;
  playbackState: SequencePlaybackState;
  role: TrackRole;
  fade: SequenceFade | null;
}) => {
  const pluginApi = usePluginAPI();

  const gain = useFadeGain(fade, role === "outgoing" ? "out" : "in");
  const volume =
    volumeToAmplitude(
      pluginApi.audio.useVolume(
        pluginApi.renderer.useData((x) => x.volume) ?? 1,
      ),
    ) * (role === "upcoming" ? 0 : gain);

  const mutableSceneData = pluginApi.scene.useValtioData();

  const videoPlaybackState = useMemo(
    () => ({ ...playbackState, volume }),
    [playbackState, volume],
  );
  const video = useMemo(() => trackVideo(track), [track]);

  if (!video) {
    return null;
  }

  return (
    <div style={hiddenStyle} aria-hidden>
      <VideoPlayer
        video={video}
        playbackState={videoPlaybackState}
        onDurationChange={(duration: number) => {
          const mutableTrack = mutableSceneData.pluginData.tracks.find(
            (x) => x.id === track.id,
          );
          // Without a duration the playlist can't move past this track
          if (mutableTrack && !mutableTrack.metadata.duration) {
            mutableTrack.metadata.duration = duration;
          }
        }}
        onAwarenessLoadingChange={(isLoading: boolean) => {
          // The others load and fade in the background
          if (role === "current") {
            pluginApi.awareness.setAwarenessStateData({ isLoading });
          }
        }}
        onError={(err: Error, errorData?: unknown) => {
          pluginApi.log.error(
            { err, errorData, url: video.url },
            "Error on track playback",
          );
          if (role === "current") {
            pluginApi.awareness.setAwarenessStateData({ isError: true });
          }
        }}
      />
    </div>
  );
};

export default TrackPlayer;
