import { PluginRendererState } from "@repo/base-plugin";

export type PluginBaseData = {
  url: string;
};

export type PluginRendererData = PluginRendererState & {
  isPlaying: boolean;
  volume: number;
};
