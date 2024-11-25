export type PluginBaseData = {
  files: {
    key: string;
    url: string;
  }[];
};

export type PluginRendererData = {
  currentKey: string;
  isPlaying: boolean;
  volume: number;
};
