import { useEffect, useMemo, useRef, useState } from "react";

import {
  calculateEffectiveTimerState,
  calculateProgress,
  hasTimeOfDay as checkHasTimeOfDay,
  formatTimeOfDay,
  getDisplayTime,
  getTimerColor,
  getTimerColorState,
} from "../../src/timerUtils";
import { TimerItem } from "../../src/types";
import { usePluginAPI } from "../pluginApi";
import { getSvgMeasurement } from "./cache";

// Style constants
const TIMER_FONT_FAMILY = "ui-monospace, monospace";
const TEXT_FONT_FAMILY = "system-ui, sans-serif";
const LINE_HEIGHT = 1.2;
const LINE_HEIGHT_AFTER_TITLE = 0.9;
const PROGRESS_BAR_HEIGHT = 8;

const Renderer = () => {
  const pluginApi = usePluginAPI();
  const [tick, setTick] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Scene data
  const timers = pluginApi.scene.useData((x) => x.pluginData.timers) ?? [];
  const showProgressBar =
    pluginApi.scene.useData((x) => x.pluginData.showProgressBar) ?? true;

  // Renderer data (base values from state)
  const baseTimerIndex =
    pluginApi.renderer.useData((x) => x.activeTimerIndex) ?? 0;
  const isRunning = pluginApi.renderer.useData((x) => x.isRunning) ?? false;
  const timeStarted = pluginApi.renderer.useData((x) => x.timeStarted);
  const timeAdjustment =
    pluginApi.renderer.useData((x) => x.timeAdjustment) ?? 0;
  const isBlackout = pluginApi.renderer.useData((x) => x.isBlackout) ?? false;

  // Calculate effective timer state (handles auto-next without mutation)
  const { effectiveTimerIndex, effectiveRemaining, effectiveElapsed } =
    calculateEffectiveTimerState(
      timers,
      baseTimerIndex,
      timeStarted,
      isRunning,
      timeAdjustment,
    );

  // Get the effective active timer
  const activeTimer: TimerItem | undefined = timers[effectiveTimerIndex];

  // Force re-render every 100ms when running or showing time of day
  const activeTimerMode = activeTimer?.mode;
  useEffect(() => {
    const showsTimeOfDay = activeTimerMode
      ? checkHasTimeOfDay(activeTimerMode) || activeTimerMode === "timeOfDay"
      : false;
    const needsUpdate = isRunning || showsTimeOfDay;

    if (!needsUpdate) return;

    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 100);

    return () => clearInterval(interval);
  }, [isRunning, activeTimerMode]);

  // Use the effective values for display
  const remaining = effectiveRemaining;
  const elapsed = effectiveElapsed;

  const displayTime = activeTimer
    ? getDisplayTime(
        activeTimer.mode,
        remaining,
        elapsed,
        activeTimer.overtimeBehavior,
      )
    : "";
  const hasTitle = !!activeTimer?.title;
  const hasTimeOfDay = activeTimer
    ? checkHasTimeOfDay(activeTimer.mode)
    : false;

  // Determine color state
  const colorState = activeTimer
    ? getTimerColorState(
        activeTimer.mode,
        activeTimer.duration,
        remaining,
        elapsed,
        activeTimer.wrapUpYellow,
        activeTimer.wrapUpRed,
      )
    : "normal";
  const timerColor = getTimerColor(colorState);

  // Calculate progress
  const progress = activeTimer
    ? calculateProgress(
        activeTimer.mode,
        activeTimer.duration,
        remaining,
        elapsed,
      )
    : 0;

  // Build text lines for measurement
  // We use relative font sizes where timer is 1rem (the base)
  const textLines = useMemo(() => {
    const lines: { text: string; fontSize: string; dy: string }[] = [];

    if (hasTitle && activeTimer?.title) {
      lines.push({ text: activeTimer.title, fontSize: "0.25rem", dy: "1em" });
    }

    // Main timer - always present (base size)
    // Use tighter spacing after title
    lines.push({
      text: displayTime || "0:00",
      fontSize: "1rem",
      dy: hasTitle ? `${LINE_HEIGHT_AFTER_TITLE}em` : "1em",
    });

    if (hasTimeOfDay) {
      lines.push({
        text: formatTimeOfDay(),
        fontSize: "0.18rem",
        dy: `${LINE_HEIGHT}em`,
      });
    }

    return lines;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tick forces TOD update
  }, [hasTitle, activeTimer, displayTime, hasTimeOfDay, tick]);

  // Measure SVG text for auto-sizing
  const measuredData = useMemo(
    () =>
      getSvgMeasurement({
        lines: textLines,
        style: {
          fontFamily: TIMER_FONT_FAMILY,
          fontWeight: "bold",
        },
      }),
    [textLines],
  );

  const viewBox = useMemo(
    () => [0, 0, measuredData.width, measuredData.height].join(" "),
    [measuredData.width, measuredData.height],
  );

  // Blackout mode
  if (isBlackout) {
    return (
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "black",
        }}
      />
    );
  }

  // No timer
  if (!activeTimer) {
    return (
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "black",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#666666",
          fontFamily: TEXT_FONT_FAMILY,
          fontSize: "2rem",
        }}
      >
        No Timer
      </div>
    );
  }

  // Hide timer completely if overtime and behavior is "hide"
  if (remaining <= 0 && activeTimer.overtimeBehavior === "hide") {
    return (
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "black",
        }}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "black",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* SVG Timer Display */}
      <svg
        viewBox={viewBox}
        xmlns="http://www.w3.org/2000/svg"
        style={{
          width: "100%",
          height: showProgressBar
            ? `calc(100% - ${PROGRESS_BAR_HEIGHT}px)`
            : "100%",
          overflow: "visible",
          userSelect: "none",
        }}
        preserveAspectRatio="xMidYMid meet"
      >
        <text
          x="50%"
          style={{
            fontFamily: TIMER_FONT_FAMILY,
            fontWeight: "bold",
            textAnchor: "middle",
          }}
        >
          {textLines.map((line, i) => (
            <tspan
              key={i}
              x="50%"
              dy={line.dy}
              style={{
                fontSize: line.fontSize,
                fontFamily:
                  i === 0 && hasTitle ? TEXT_FONT_FAMILY : TIMER_FONT_FAMILY,
                fontWeight: i === 0 && hasTitle ? 600 : "bold",
              }}
              fill={
                i === 0 && hasTitle
                  ? "white"
                  : i === 1 || (i === 0 && !hasTitle) || textLines.length === 1
                    ? timerColor
                    : "#9ca3af"
              }
            >
              {line.text}
            </tspan>
          ))}
        </text>
      </svg>

      {/* Progress Bar - fixed height, full width */}
      {showProgressBar && (
        <div
          style={{
            width: "100%",
            height: PROGRESS_BAR_HEIGHT,
            backgroundColor: "#1f2937",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              backgroundColor: timerColor,
              transition: "width 0.1s linear",
            }}
          />
        </div>
      )}
    </div>
  );
};

export default Renderer;
