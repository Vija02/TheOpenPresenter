import { Button } from "@repo/ui";
import {
  SequenceRepeat,
  UniversalVideo,
  VideoPlaybackState,
} from "@repo/video";
import { VideoPlayer, useComputedPlaybackState } from "@repo/video/client";
import { useMemo } from "react";
import {
  FaBackwardStep,
  FaForwardStep,
  FaPause,
  FaPlay,
} from "react-icons/fa6";
import { MdRepeat, MdRepeatOne } from "react-icons/md";
import { TbPlayerTrackNext } from "react-icons/tb";
import { Scrubber } from "react-scrubber";

import { SpeedButton } from "./SpeedButton";
import { formatDuration } from "./formatDuration";
import { VideoPlayerControls } from "./useVideoPlayerControls";

const nextRepeatMode: Record<SequenceRepeat, SequenceRepeat> = {
  off: "all",
  all: "one",
  one: "off",
};
const repeatModeLabel: Record<SequenceRepeat, string> = {
  off: "Repeat off",
  all: "Repeat all videos",
  one: "Repeat video",
};

export const NowPlaying = ({
  video,
  playbackState,
  autoplay,
  repeatMode,
  controls,
}: {
  video: UniversalVideo;
  playbackState: VideoPlaybackState;
  autoplay: boolean;
  repeatMode: SequenceRepeat;
  controls: VideoPlayerControls;
}) => {
  const duration = video.metadata.duration ?? 0;
  const { isPlaying, currentSeek, currentTimeSeconds } =
    useComputedPlaybackState(playbackState, duration);

  // Silent, since the sound is for the room
  const previewPlaybackState = useMemo(
    () => ({ ...playbackState, muted: true }),
    [playbackState],
  );

  const autoplayLabel = autoplay
    ? "Autoplay on: plays the next video when one finishes"
    : "Autoplay off";

  return (
    <div
      data-testid="now-playing"
      className="stack-col items-stretch gap-2 p-2 mb-3 border border-black/20 rounded-sm shadow-sm"
    >
      <div className="stack-col items-stretch gap-2">
        <div
          className="aspect-video w-full max-w-3xl self-center rounded-sm overflow-hidden bg-black pointer-events-none select-none"
          aria-hidden
          inert
        >
          <VideoPlayer
            key={video.id}
            video={video}
            playbackState={previewPlaybackState}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-wide text-secondary">
            Now playing
          </p>
          <p className="truncate font-bold">
            {video.metadata.title ?? video.url}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 @lg:flex-nowrap">
        <div className="stack-row order-2 @lg:order-none">
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
            onClick={() => controls.toggleVideo(video.id)}
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
        </div>
        <div className="stack-row basis-full order-1 @lg:order-none @lg:basis-auto @lg:flex-1 min-w-0">
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
            {duration > 0 ? formatDuration(duration) : "--:--"}
          </span>
        </div>
        <div className="stack-row order-3 ml-auto @lg:order-none @lg:ml-0">
          <Button
            variant={repeatMode === "off" ? "ghost" : "default"}
            size="sm"
            onClick={() => controls.setRepeatMode(nextRepeatMode[repeatMode])}
            aria-label={repeatModeLabel[repeatMode]}
            title={repeatModeLabel[repeatMode]}
          >
            {repeatMode === "one" ? <MdRepeatOne /> : <MdRepeat />}
          </Button>
          <Button
            variant={autoplay ? "default" : "ghost"}
            size="sm"
            onClick={() => controls.setAutoplay(!autoplay)}
            aria-label={autoplayLabel}
            title={autoplayLabel}
          >
            <TbPlayerTrackNext />
          </Button>
          <SpeedButton
            playbackRate={playbackState.playbackRate ?? 1}
            controls={controls}
          />
        </div>
      </div>
    </div>
  );
};
