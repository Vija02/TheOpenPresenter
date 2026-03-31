// Timer display modes
export type TimerMode =
  | "countdown"
  | "countup"
  | "timeOfDay"
  | "countdownTod"
  | "countupTod"
  | "countdownToTime";

// What happens when timer reaches zero
export type OvertimeBehavior = "stop" | "continue" | "hide" | "next";

// Individual timer in the rundown
export type TimerItem = {
  id: string;
  title: string;
  // Duration in milliseconds
  duration: number;
  // How the timer is displayed
  mode: TimerMode;
  // What happens at zero
  overtimeBehavior: OvertimeBehavior;
  // Percentage of duration remaining to turn yellow (0-100)
  wrapUpYellow: number;
  // Percentage of duration remaining to turn red (0-100)
  wrapUpRed: number;
  // Target time for countdownToTime mode (HH:MM:SS format, e.g., "14:30:00")
  // Using null instead of undefined for valtio-yjs compatibility
  targetTime: string | null;
};

// Scene data - persisted configuration
export type PluginBaseData = {
  timers: TimerItem[];
  // Whether to show progress bar on renderer
  showProgressBar: boolean;
  // Default wrap-up percentages for new timers (0-100)
  defaultWrapUpYellow: number;
  defaultWrapUpRed: number;
};

// Renderer data - runtime state
export type PluginRendererData = {
  // Which timer is currently selected/displayed
  activeTimerIndex: number;
  // Whether the timer is running
  isRunning: boolean;
  // Unix timestamp when timer was started (null if not running)
  timeStarted: number | null;
  // Time adjustment from tweak/nudge (in milliseconds, can be negative)
  timeAdjustment: number;
  // Whether display is blacked out
  isBlackout: boolean;
};

// Color states for the timer display
export type TimerColorState = "normal" | "yellow" | "red" | "overtime";

// Timer mode labels for UI
export const TIMER_MODE_LABELS: Record<TimerMode, string> = {
  countdown: "Countdown",
  countup: "Count Up",
  timeOfDay: "Time of Day",
  countdownTod: "Countdown + ToD",
  countupTod: "Count Up + ToD",
  countdownToTime: "Countdown to Time",
};

// Overtime behavior labels for UI
export const OVERTIME_BEHAVIOR_LABELS: Record<OvertimeBehavior, string> = {
  stop: "Stop at Zero",
  continue: "Continue to negative",
  hide: "Hide at Zero",
  next: "Auto proceed next timer",
};
