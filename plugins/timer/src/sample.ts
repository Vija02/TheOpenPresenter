import type { PluginSample } from "@repo/base-types";

import type { PluginBaseData, PluginRendererData } from "./types";

const timer = (id: string, title: string, minutes: number) => ({
  id,
  title,
  duration: minutes * 60 * 1000,
  mode: "countdown" as const,
  overtimeBehavior: "continue" as const,
  wrapUpYellow: 15,
  wrapUpRed: 5,
  targetTime: null,
});

const pluginData: PluginBaseData = {
  timers: [
    timer("sample-sermon", "Sermon", 25),
    timer("sample-close", "Closing", 5),
  ],
  showProgressBar: true,
  defaultWrapUpYellow: 15,
  defaultWrapUpRed: 5,
};

const rendererData: PluginRendererData = {
  activeTimerIndex: 0,
  isRunning: false,
  timeStarted: null,
  timeAdjustment: 0,
  isBlackout: false,
};

/** A sermon countdown, ready to start */
export const sample: PluginSample = { pluginData, rendererData };
