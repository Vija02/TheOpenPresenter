import {
  Button,
  Popover,
  PopoverContent,
  PopoverMenuItem,
  PopoverTrigger,
} from "@repo/ui";
import { FaCheck } from "react-icons/fa6";
import { TbArrowsCross } from "react-icons/tb";

import { PlayerControls } from "./usePlayerControls";

const CROSSFADE_OPTIONS = [0, 3, 6, 9, 12];

export const CrossfadeButton = ({
  crossfadeSeconds,
  controls,
}: {
  crossfadeSeconds: number;
  controls: PlayerControls;
}) => {
  const label = crossfadeSeconds
    ? `Crossfade ${crossfadeSeconds}s`
    : "Crossfade off";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={crossfadeSeconds ? "default" : "ghost"}
          size="sm"
          aria-label={label}
          title={label}
        >
          <TbArrowsCross />
          {!!crossfadeSeconds && (
            <span className="text-xs tabular-nums">{crossfadeSeconds}s</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        hideArrow
        hideCloseButton
        className="w-48 p-1"
      >
        <p className="px-3 py-1 text-xs text-secondary">Fade between tracks</p>
        {CROSSFADE_OPTIONS.map((seconds) => (
          <PopoverMenuItem
            key={seconds}
            label={seconds ? `${seconds} seconds` : "Off"}
            icon={
              <FaCheck
                className={seconds === crossfadeSeconds ? "" : "invisible"}
              />
            }
            onClick={() => controls.setCrossfade(seconds)}
          />
        ))}
      </PopoverContent>
    </Popover>
  );
};
