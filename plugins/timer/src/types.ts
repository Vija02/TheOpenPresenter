export type PluginBaseData = {
  // Millisecond
  timerDuration: number;
};

export type PluginRendererData = {
  isRunning: boolean;
  // Unix timestamp
  timeStarted: number | null;
};
