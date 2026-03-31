import {
  OvertimeBehavior,
  TimerColorState,
  TimerItem,
  TimerMode,
} from "./types";

/**
 * Calculate the remaining time for a countdown timer
 * Returns milliseconds remaining (can be negative for overtime)
 */
export function calculateTimeRemaining(
  duration: number,
  timeStarted: number | null,
  isRunning: boolean,
  timeAdjustment: number,
): number {
  if (!isRunning || timeStarted === null) {
    return duration + timeAdjustment;
  }

  const now = Date.now();
  const elapsed = now - timeStarted;
  const adjustedDuration = duration + timeAdjustment;

  return adjustedDuration - elapsed;
}

/**
 * Calculate elapsed time for a count-up timer
 * Returns milliseconds elapsed
 * @param timeAdjustment - Positive values increase elapsed time, negative decrease
 */
export function calculateTimeElapsed(
  timeStarted: number | null,
  isRunning: boolean,
  timeAdjustment: number = 0,
): number {
  if (!isRunning || timeStarted === null) {
    return Math.max(0, timeAdjustment);
  }

  return Math.max(0, Date.now() - timeStarted + timeAdjustment);
}

/**
 * Format milliseconds to time string
 * @param ms - Milliseconds (can be negative)
 * @param showHours - Force showing hours even if 0
 * @param showMilliseconds - Show milliseconds
 */
export function formatTime(
  ms: number,
  showHours: boolean = false,
  showMilliseconds: boolean = false,
): string {
  const isNegative = ms < 0;
  const absMs = Math.abs(ms);

  const totalSeconds = Math.floor(absMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = Math.floor((absMs % 1000) / 100); // Single digit

  const prefix = isNegative ? "-" : "";

  let timeStr: string;
  if (hours > 0 || showHours) {
    timeStr = `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  } else {
    timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  if (showMilliseconds) {
    timeStr += `.${milliseconds}`;
  }

  return prefix + timeStr;
}

/**
 * Format current time of day
 * @param use24Hour - Use 24-hour format
 */
export function formatTimeOfDay(use24Hour: boolean = true): string {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  if (use24Hour) {
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  } else {
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 === 0 ? 12 : hours % 12;
    return `${displayHours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")} ${period}`;
  }
}

/**
 * Parse a duration string to milliseconds
 * Supports formats: "5:00", "1:30:00", "5m", "90s", "300", etc.
 */
export function parseDuration(input: string): number | null {
  const trimmed = input.trim();

  if (!trimmed) return null;

  // Check for "Xm" format (minutes)
  const minuteMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*m$/i);
  if (minuteMatch) {
    return Math.floor(parseFloat(minuteMatch[1]!) * 60 * 1000);
  }

  // Check for "Xs" format (seconds)
  const secondMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*s$/i);
  if (secondMatch) {
    return Math.floor(parseFloat(secondMatch[1]!) * 1000);
  }

  // Check for "Xh" format (hours)
  const hourMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*h$/i);
  if (hourMatch) {
    return Math.floor(parseFloat(hourMatch[1]!) * 3600 * 1000);
  }

  // Check for MM:SS or HH:MM:SS format
  const timeMatch = trimmed.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (timeMatch) {
    if (timeMatch[3] !== undefined) {
      // HH:MM:SS
      const hours = parseInt(timeMatch[1]!, 10);
      const minutes = parseInt(timeMatch[2]!, 10);
      const seconds = parseInt(timeMatch[3], 10);
      return (hours * 3600 + minutes * 60 + seconds) * 1000;
    } else {
      // MM:SS
      const minutes = parseInt(timeMatch[1]!, 10);
      const seconds = parseInt(timeMatch[2]!, 10);
      return (minutes * 60 + seconds) * 1000;
    }
  }

  // Plain number (assume seconds)
  const num = parseFloat(trimmed);
  if (!isNaN(num)) {
    return Math.floor(num * 1000);
  }

  return null;
}

/**
 * Format duration for input display (MM:SS or HH:MM:SS)
 */
export function formatDurationForInput(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Get the color state of the timer based on mode and time values
 * For countdown: based on remaining time percentage
 * For countup: based on elapsed time percentage
 * @param wrapUpYellowPercent - Percentage of duration remaining to turn yellow (0-100)
 * @param wrapUpRedPercent - Percentage of duration remaining to turn red (0-100)
 */
export function getTimerColorState(
  mode: TimerMode,
  duration: number,
  remaining: number,
  elapsed: number,
  wrapUpYellowPercent: number,
  wrapUpRedPercent: number,
): TimerColorState {
  if (duration <= 0) return "normal";

  // Calculate percentage remaining (0-100)
  const percentRemaining =
    mode === "countup" || mode === "countupTod"
      ? ((duration - elapsed) / duration) * 100
      : (remaining / duration) * 100;

  if (percentRemaining <= 0) {
    return "overtime";
  }
  if (percentRemaining <= wrapUpRedPercent) {
    return "red";
  }
  if (percentRemaining <= wrapUpYellowPercent) {
    return "yellow";
  }
  return "normal";
}

/**
 * Get CSS color for timer state
 */
export function getTimerColor(state: TimerColorState): string {
  switch (state) {
    case "normal":
      return "#22c55e"; // green-500
    case "yellow":
      return "#eab308"; // yellow-500
    case "red":
      return "#ef4444"; // red-500
    case "overtime":
      return "#ef4444"; // red-500
    default:
      return "#ffffff";
  }
}

/**
 * Calculate progress percentage (0-100)
 */
export function calculateProgress(
  mode: TimerMode,
  duration: number,
  remaining: number,
  elapsed: number,
): number {
  if (duration <= 0) return 100;

  // For countup modes, use elapsed time directly
  if (mode === "countup" || mode === "countupTod") {
    const progress = (elapsed / duration) * 100;
    return Math.max(0, Math.min(100, progress));
  }

  // For countdown modes, calculate from remaining
  const elapsedFromRemaining = duration - remaining;
  const progress = (elapsedFromRemaining / duration) * 100;
  return Math.max(0, Math.min(100, progress));
}

/**
 * Get display time string based on timer mode
 */
export function getDisplayTime(
  mode: TimerMode,
  remaining: number,
  elapsed: number,
  overtimeBehavior: OvertimeBehavior,
): string {
  switch (mode) {
    case "countdown":
    case "countdownTod": {
      if (remaining <= 0) {
        switch (overtimeBehavior) {
          case "stop":
          case "next":
            return "0:00";
          case "continue":
            return formatTime(remaining);
          case "hide":
            return "";
        }
      }
      return formatTime(remaining);
    }
    case "countup":
    case "countupTod": {
      return formatTime(elapsed);
    }
    case "timeOfDay": {
      return formatTimeOfDay();
    }
    default:
      return formatTime(remaining);
  }
}

/**
 * Check if the timer mode shows time of day
 */
export function hasTimeOfDay(mode: TimerMode): boolean {
  return mode === "countdownTod" || mode === "countupTod";
}

/**
 * Create a default timer item
 */
export function createDefaultTimer(
  id: string,
  defaultWrapUpYellow: number = 15,
  defaultWrapUpRed: number = 5,
): TimerItem {
  return {
    id,
    title: "New Timer",
    duration: 5 * 60 * 1000, // 5 minutes
    mode: "countdown" as TimerMode,
    overtimeBehavior: "stop",
    wrapUpYellow: defaultWrapUpYellow,
    wrapUpRed: defaultWrapUpRed,
  };
}

/**
 * Generate a simple unique ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

/**
 * Calculate the effective timer index and time remaining when using auto-next.
 * This allows us to infer the current timer state without mutating data.
 *
 * @returns Object with effectiveTimerIndex, effectiveRemaining, effectiveElapsed, and isStopped
 */
export function calculateEffectiveTimerState(
  timers: TimerItem[],
  baseTimerIndex: number,
  timeStarted: number | null,
  isRunning: boolean,
  timeAdjustment: number,
): {
  effectiveTimerIndex: number;
  effectiveRemaining: number;
  effectiveElapsed: number;
  isStopped: boolean;
} {
  if (!isRunning || timeStarted === null || timers.length === 0) {
    const timer = timers[baseTimerIndex];
    return {
      effectiveTimerIndex: baseTimerIndex,
      effectiveRemaining: timer ? timer.duration + timeAdjustment : 0,
      effectiveElapsed: Math.max(0, timeAdjustment),
      isStopped: true,
    };
  }

  const now = Date.now();
  let totalElapsed = now - timeStarted + timeAdjustment;
  let currentIndex = baseTimerIndex;

  // Walk through timers, consuming time for those with "next" behavior
  while (currentIndex < timers.length) {
    const timer = timers[currentIndex];
    if (!timer) break;

    const timerDuration = timer.duration;

    // If this timer hasn't finished yet, or doesn't auto-advance
    if (totalElapsed < timerDuration || timer.overtimeBehavior !== "next") {
      // This is our effective timer
      const effectiveRemaining = timerDuration - totalElapsed;
      return {
        effectiveTimerIndex: currentIndex,
        effectiveRemaining,
        effectiveElapsed: totalElapsed,
        isStopped: false,
      };
    }

    // Timer has finished and has "next" behavior, move to next timer
    totalElapsed -= timerDuration;
    currentIndex++;
  }

  // We've gone past all timers - stay on the last timer
  // At this point, totalElapsed is the time elapsed since the last timer started
  const lastIndex = timers.length - 1;
  const lastTimer = timers[lastIndex];
  if (lastTimer) {
    return {
      effectiveTimerIndex: lastIndex,
      effectiveRemaining: lastTimer.duration - totalElapsed,
      effectiveElapsed: totalElapsed,
      isStopped: lastTimer.overtimeBehavior !== "continue",
    };
  }

  return {
    effectiveTimerIndex: baseTimerIndex,
    effectiveRemaining: 0,
    effectiveElapsed: totalElapsed,
    isStopped: true,
  };
}
