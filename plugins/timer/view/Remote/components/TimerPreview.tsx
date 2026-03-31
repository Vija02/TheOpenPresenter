import { useEffect, useState } from "react";

import {
  calculateEffectiveTimerState,
  calculateProgress,
  getDisplayTime,
  getTimerColor,
  getTimerColorState,
  hasTimeOfDay,
} from "../../../src/timerUtils";
import { TimerItem } from "../../../src/types";

type TimerPreviewProps = {
  timers: TimerItem[];
  baseTimerIndex: number;
  isRunning: boolean;
  timeStarted: number | null;
  timeAdjustment: number;
};

export const TimerPreview = ({
  timers,
  baseTimerIndex,
  isRunning,
  timeStarted,
  timeAdjustment,
}: TimerPreviewProps) => {
  const [, setTick] = useState(0);

  // Calculate effective timer state (handles auto-next)
  const { effectiveTimerIndex, effectiveRemaining, effectiveElapsed } =
    calculateEffectiveTimerState(
      timers,
      baseTimerIndex,
      timeStarted,
      isRunning,
      timeAdjustment,
    );

  const timer = timers[effectiveTimerIndex];

  // Force re-render every 100ms when running or showing time of day
  useEffect(() => {
    const needsUpdate =
      isRunning ||
      timer?.mode === "timeOfDay" ||
      hasTimeOfDay(timer?.mode ?? "countdown");

    if (!needsUpdate) return;

    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 100);

    return () => clearInterval(interval);
  }, [isRunning, timer?.mode]);

  if (!timer) {
    return (
      <div className="bg-black rounded-lg p-4 text-center">
        <span className="text-gray-500 text-sm">No timer selected</span>
      </div>
    );
  }

  const remaining = effectiveRemaining;
  const elapsed = effectiveElapsed;

  const colorState = getTimerColorState(
    timer.mode,
    timer.duration,
    remaining,
    elapsed,
    timer.wrapUpYellow,
    timer.wrapUpRed,
  );
  const color = getTimerColor(colorState);
  const progress = calculateProgress(
    timer.mode,
    timer.duration,
    remaining,
    elapsed,
  );

  const displayTime = getDisplayTime(
    timer.mode,
    remaining,
    elapsed,
    timer.overtimeBehavior,
  );

  return (
    <div className="bg-black rounded-lg p-4 relative overflow-hidden">
      {/* Title */}
      {timer.title && (
        <div className="text-gray-400 text-xs text-center mb-1 truncate">
          {timer.title}
        </div>
      )}

      {/* Time display */}
      <div
        className="text-3xl font-mono text-center font-bold"
        style={{ color }}
      >
        {displayTime}
      </div>

      {/* Progress bar */}
      <div className="mt-2 h-1 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full transition-all duration-100"
          style={{
            width: `${progress}%`,
            backgroundColor: color,
          }}
        />
      </div>

      {/* Running indicator */}
      {isRunning && (
        <div className="absolute top-2 right-2">
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: color }}
          />
        </div>
      )}
    </div>
  );
};
