import { PluginRendererState } from "@repo/base-plugin";

export type PluginBaseData = {
  videos: Video[];
};

export type Video = {
  id: string;
  url: string;
  metadata: {
    title?: string;
    // In seconds
    duration?: number;
  };
};

export type PluginRendererData = PluginRendererState & {
  currentPlayingVideo: CurrentPlayingVideo | null;
  videoSeeks: Record<string, number>;
  // 0 to 1
  isPlaying: boolean;
  // 0 to 1
  volume: number;
};

export type CurrentPlayingVideo = {
  // Unique ID for the current user interaction
  // We use this to make sure that the UI is crisp
  uid?: string;
  videoId: string;
  // 0 to 1
  playFrom: number;
  // UNIX Timestamp
  startedAt: number;
  wasPlayingBeforeSeek?: boolean | null;
};
