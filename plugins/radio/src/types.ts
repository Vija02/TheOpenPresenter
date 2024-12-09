import { PluginRendererState } from "@repo/base-plugin";

export type PluginBaseData = {
  url: string;
};

export type PluginRendererData = PluginRendererState & {
  url: string | null;
  isPlaying: boolean;
  volume: number;
};
