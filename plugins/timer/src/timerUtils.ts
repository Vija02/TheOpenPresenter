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
  targetTime?: string | null,
): TimerColorState {
  // For countdownToTime, use time-based thresholds (duration acts as the "total" reference)
  if (mode === "countdownToTime") {
    const timeToTarget = calculateTimeToTarget(targetTime ?? null);
    if (timeToTarget <= 0) {
      return "overtime";
    }
    // Use duration as reference for percentage calculation
    if (duration <= 0) return "normal";
    const percentRemaining = (timeToTarget / duration) * 100;
    if (percentRemaining <= wrapUpRedPercent) {
      return "red";
    }
    if (percentRemaining <= wrapUpYellowPercent) {
      return "yellow";
    }
    return "normal";
  }

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
  targetTime?: string | null,
): number {
  if (duration <= 0) return 100;

  // For countdownToTime, calculate progress based on time to target
  if (mode === "countdownToTime") {
    const timeToTarget = calculateTimeToTarget(targetTime ?? null);
    if (timeToTarget <= 0) return 100;
    // Use duration as the "total" reference for progress
    const elapsedFromDuration = duration - timeToTarget;
    const progress = (elapsedFromDuration / duration) * 100;
    return Math.max(0, Math.min(100, progress));
  }

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
  targetTime?: string | null,
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
    case "countdownToTime": {
      const timeToTarget = calculateTimeToTarget(targetTime ?? null);
      if (timeToTarget <= 0) {
        switch (overtimeBehavior) {
          case "stop":
          case "next":
            return "0:00";
          case "continue":
            return formatTime(timeToTarget);
          case "hide":
            return "";
        }
      }
      return formatTime(timeToTarget);
    }
    default:
      return formatTime(remaining);
  }
}

/**
 * Check if the timer mode shows time of day
 */
export function hasTimeOfDay(mode: TimerMode): boolean {
  return (
    mode === "countdownTod" ||
    mode === "countupTod" ||
    mode === "countdownToTime"
  );
}

/**
 * Parse a target time string (HH:MM or HH:MM:SS) to milliseconds from midnight
 */
export function parseTargetTime(timeStr: string): number | null {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;

  const hours = parseInt(match[1]!, 10);
  const minutes = parseInt(match[2]!, 10);
  const seconds = match[3] ? parseInt(match[3], 10) : 0;

  if (
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }

  return (hours * 3600 + minutes * 60 + seconds) * 1000;
}

/**
 * Calculate remaining time until a target time of day
 * Returns milliseconds remaining (always positive, wraps to next day if needed)
 */
export function calculateTimeToTarget(targetTime: string | null): number {
  if (!targetTime) return 0;

  const targetMs = parseTargetTime(targetTime);
  if (targetMs === null) return 0;

  const now = new Date();
  const currentMs =
    (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) * 1000 +
    now.getMilliseconds();

  let remaining = targetMs - currentMs;

  // If target time has passed today, wrap to tomorrow
  if (remaining < 0) {
    const msInDay = 24 * 60 * 60 * 1000;
    remaining += msInDay;
  }

  return remaining;
}

/**
 * Check if a target time has been crossed since a given start time
 * Returns the milliseconds elapsed since crossing, or null if not crossed yet
 */
export function getTimeSinceTargetCrossed(
  targetTime: string | null,
  startedAt: number,
): number | null {
  if (!targetTime) return null;

  const targetMs = parseTargetTime(targetTime);
  if (targetMs === null) return null;

  const now = new Date();
  const startDate = new Date(startedAt);

  // Get time-of-day in ms for both start and now
  const startTimeOfDay =
    (startDate.getHours() * 3600 +
      startDate.getMinutes() * 60 +
      startDate.getSeconds()) *
      1000 +
    startDate.getMilliseconds();
  const nowTimeOfDay =
    (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) * 1000 +
    now.getMilliseconds();

  // Check if we started before target and are now at or after target (same day)
  if (startTimeOfDay < targetMs && nowTimeOfDay >= targetMs) {
    return nowTimeOfDay - targetMs;
  }

  // Check if we've crossed midnight and passed target on the new day
  // This handles: started at 23:00, target is 02:00, now is 02:30
  if (startTimeOfDay > nowTimeOfDay && nowTimeOfDay >= targetMs) {
    return nowTimeOfDay - targetMs;
  }

  // Check if we've been running for more than a day (edge case)
  const elapsedMs = now.getTime() - startedAt;
  const msInDay = 24 * 60 * 60 * 1000;
  if (elapsedMs >= msInDay) {
    // We've definitely crossed the target at least once
    // Calculate time since the most recent crossing
    return nowTimeOfDay >= targetMs
      ? nowTimeOfDay - targetMs
      : msInDay - targetMs + nowTimeOfDay;
  }

  return null;
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
    targetTime: null,
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
    // For countdownToTime mode when not running, show the time to target
    if (timer?.mode === "countdownToTime") {
      const timeToTarget = calculateTimeToTarget(timer.targetTime);
      return {
        effectiveTimerIndex: baseTimerIndex,
        effectiveRemaining: timeToTarget,
        effectiveElapsed: 0,
        isStopped: true,
      };
    }
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
  // Track the effective start time for the current timer in the chain
  let effectiveStartTime = timeStarted;

  // Walk through timers, consuming time for those with "next" behavior
  while (currentIndex < timers.length) {
    const timer = timers[currentIndex];
    if (!timer) break;

    // Handle countdownToTime mode specially
    if (timer.mode === "countdownToTime") {
      const timeToTarget = calculateTimeToTarget(timer.targetTime);
      const timeSinceCrossed = getTimeSinceTargetCrossed(
        timer.targetTime,
        effectiveStartTime,
      );
      const isComplete = timeSinceCrossed !== null;

      // If not complete or doesn't auto-advance, this is our timer
      if (!isComplete || timer.overtimeBehavior !== "next") {
        return {
          effectiveTimerIndex: currentIndex,
          effectiveRemaining: timeToTarget,
          effectiveElapsed: timer.duration - timeToTarget,
          isStopped: false,
        };
      }

      // Timer is complete and has "next" behavior, move to next timer
      // Use the time since target was crossed as elapsed for next timer
      totalElapsed = timeSinceCrossed;
      // Update effective start time for next timer
      effectiveStartTime = now - timeSinceCrossed;
      currentIndex++;
      continue;
    }

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
    // Update effective start time for next timer
    effectiveStartTime = now - totalElapsed;
    currentIndex++;
  }

  // We've gone past all timers - stay on the last timer
  // At this point, totalElapsed is the time elapsed since the last timer started
  const lastIndex = timers.length - 1;
  const lastTimer = timers[lastIndex];
  if (lastTimer) {
    // Handle countdownToTime for the last timer
    if (lastTimer.mode === "countdownToTime") {
      const timeToTarget = calculateTimeToTarget(lastTimer.targetTime);
      return {
        effectiveTimerIndex: lastIndex,
        effectiveRemaining: timeToTarget,
        effectiveElapsed: lastTimer.duration - timeToTarget,
        isStopped: lastTimer.overtimeBehavior !== "continue",
      };
    }
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
