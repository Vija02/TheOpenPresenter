import { Button } from "@repo/ui";
import { MdOutlineVisibility, MdOutlineVisibilityOff } from "react-icons/md";
import {
  VscChevronLeft,
  VscChevronRight,
  VscDebugPause,
  VscDebugRestart,
  VscPlay,
} from "react-icons/vsc";

type TransportControlsProps = {
  isRunning: boolean;
  isBlackout: boolean;
  hasTimers: boolean;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPlayPause: () => void;
  onReset: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onNudge: (ms: number) => void;
  onToggleBlackout: () => void;
  onOpenInView: () => void;
};

export const TransportControls = ({
  isRunning,
  isBlackout,
  hasTimers,
  canGoPrevious,
  canGoNext,
  onPlayPause,
  onReset,
  onPrevious,
  onNext,
  onNudge,
  onToggleBlackout,
  onOpenInView,
}: TransportControlsProps) => {
  return (
    <div className="space-y-2">
      {/* Main transport controls */}
      <div className="flex items-center justify-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onPrevious}
          disabled={!canGoPrevious || !hasTimers}
          title="Previous Timer"
        >
          <VscChevronLeft className="w-4 h-4" />
        </Button>

        <Button
          size="sm"
          variant={isRunning ? "destructive" : "success"}
          onClick={onPlayPause}
          disabled={!hasTimers}
          title={isRunning ? "Pause" : "Play"}
          className="w-16"
        >
          {isRunning ? (
            <VscDebugPause className="w-4 h-4" />
          ) : (
            <VscPlay className="w-4 h-4" />
          )}
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={onReset}
          disabled={!hasTimers}
          title="Reset Timer"
        >
          <VscDebugRestart className="w-4 h-4" />
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={onNext}
          disabled={!canGoNext || !hasTimers}
          title="Next Timer"
        >
          <VscChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Nudge controls */}
      <div className="flex items-center justify-center gap-1">
        <Button
          size="xs"
          variant="ghost"
          onClick={() => onNudge(-60000)}
          disabled={!hasTimers}
          title="Subtract 1 minute"
        >
          -1m
        </Button>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => onNudge(-10000)}
          disabled={!hasTimers}
          title="Subtract 10 seconds"
        >
          -10s
        </Button>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => onNudge(10000)}
          disabled={!hasTimers}
          title="Add 10 seconds"
        >
          +10s
        </Button>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => onNudge(60000)}
          disabled={!hasTimers}
          title="Add 1 minute"
        >
          +1m
        </Button>
      </div>

      {/* Blackout and View controls */}
      <div className="flex items-center justify-center gap-2">
        <Button
          size="sm"
          variant={isBlackout ? "destructive" : "outline"}
          onClick={onToggleBlackout}
          title={isBlackout ? "Show Display" : "Blackout Display"}
        >
          {isBlackout ? (
            <>
              <MdOutlineVisibilityOff className="w-4 h-4 mr-1" />
              Blackout
            </>
          ) : (
            <>
              <MdOutlineVisibility className="w-4 h-4 mr-1" />
              Blackout
            </>
          )}
        </Button>

        <Button size="sm" variant="default" onClick={onOpenInView}>
          Open in View
        </Button>
      </div>
    </div>
  );
};
