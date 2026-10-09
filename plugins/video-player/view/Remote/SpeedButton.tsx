import {
  Button,
  Popover,
  PopoverContent,
  PopoverMenuItem,
  PopoverTrigger,
} from "@repo/ui";
import { FaCheck } from "react-icons/fa6";
import { MdSpeed } from "react-icons/md";

import { VideoPlayerControls } from "./useVideoPlayerControls";

// YouTube only plays between 0.25x and 2x
const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export const SpeedButton = ({
  playbackRate,
  controls,
}: {
  playbackRate: number;
  controls: VideoPlayerControls;
}) => {
  const isNormal = playbackRate === 1;
  const label = `Speed ${playbackRate}×`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={isNormal ? "ghost" : "default"}
          size="sm"
          aria-label={label}
          title={label}
        >
          <MdSpeed />
          {!isNormal && (
            <span className="text-xs tabular-nums">{playbackRate}×</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        hideArrow
        hideCloseButton
        className="w-48 p-1"
      >
        <p className="px-3 py-1 text-xs text-secondary">Playback speed</p>
        {SPEED_OPTIONS.map((speed) => (
          <PopoverMenuItem
            key={speed}
            label={speed === 1 ? "Normal" : `${speed}×`}
            icon={
              <FaCheck className={speed === playbackRate ? "" : "invisible"} />
            }
            onClick={() => controls.setPlaybackRate(speed)}
          />
        ))}
      </PopoverContent>
    </Popover>
  );
};
