import { PluginRendererState } from "@repo/base-plugin";

export type PluginBaseData = {
  files: {
    key: string;
    url: string;
  }[];
};

export type PluginRendererData = PluginRendererState & {
  currentKey: string;
  isPlaying: boolean;
  volume: number;
};
