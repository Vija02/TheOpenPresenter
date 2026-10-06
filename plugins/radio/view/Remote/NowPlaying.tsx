import { Button } from "@repo/ui";
import { useComputedPlaybackState } from "@repo/video/client";
import {
  FaBackwardStep,
  FaForwardStep,
  FaPause,
  FaPlay,
} from "react-icons/fa6";
import { MdRepeat, MdRepeatOne } from "react-icons/md";
import { Scrubber } from "react-scrubber";

import { RepeatMode } from "../../src/types";
import { trackTitle } from "../trackHelpers";
import { usePlaylistPosition } from "../usePlaylistPosition";
import { CrossfadeButton } from "./CrossfadeButton";
import { TrackThumbnail } from "./TrackThumbnail";
import { formatDuration } from "./formatDuration";
import { PlayerControls } from "./usePlayerControls";

const nextRepeatMode: Record<RepeatMode, RepeatMode> = {
  off: "all",
  all: "one",
  one: "off",
};
const repeatModeLabel: Record<RepeatMode, string> = {
  off: "Repeat off",
  all: "Repeat playlist",
  one: "Repeat track",
};

export const NowPlaying = ({ controls }: { controls: PlayerControls }) => {
  const { track, playbackState, isPlaying, repeatMode, crossfadeSeconds } =
    usePlaylistPosition();
  const duration = track?.metadata.duration ?? 0;

  const { currentSeek, currentTimeSeconds } = useComputedPlaybackState(
    { ...playbackState, volume: 1 },
    duration,
  );

  if (!track) {
    return null;
  }

  return (
    <div
      data-testid="now-playing"
      className="stack-col items-stretch gap-2 p-2 border border-black/20 rounded-sm shadow-sm"
    >
      <div className="stack-row items-center">
        <TrackThumbnail track={track} className="w-24" />
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-wide text-secondary">
            Now playing
          </p>
          <p className="truncate font-bold">{trackTitle(track)}</p>
          {track.metadata.author && (
            <p className="truncate text-xs text-secondary">
              {track.metadata.author}
            </p>
          )}
        </div>
      </div>

      <div className="stack-row">
        <Button
          variant="ghost"
          size="sm"
          onClick={controls.previous}
          aria-label="Previous"
        >
          <FaBackwardStep />
        </Button>
        <Button
          variant={isPlaying ? "default" : "outline"}
          onClick={() => controls.toggleTrack(track.id)}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <FaPause /> : <FaPlay />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={controls.next}
          aria-label="Next"
        >
          <FaForwardStep />
        </Button>
        <span className="text-xs tabular-nums text-secondary">
          {formatDuration(currentTimeSeconds)}
        </span>
        <div className="flex-1 flex items-center">
          <Scrubber
            min={0}
            max={0.999999}
            value={currentSeek}
            onScrubStart={controls.startSeeking}
            onScrubChange={controls.updateSeeking}
            onScrubEnd={controls.endSeeking}
          />
        </div>
        <span className="text-xs tabular-nums text-secondary">
          {duration ? formatDuration(duration) : "--:--"}
        </span>
        <Button
          variant={repeatMode === "off" ? "ghost" : "default"}
          size="sm"
          onClick={() => controls.setRepeatMode(nextRepeatMode[repeatMode])}
          aria-label={repeatModeLabel[repeatMode]}
          title={repeatModeLabel[repeatMode]}
        >
          {repeatMode === "one" ? <MdRepeatOne /> : <MdRepeat />}
        </Button>
        <CrossfadeButton
          crossfadeSeconds={crossfadeSeconds}
          controls={controls}
        />
      </div>
    </div>
  );
};
