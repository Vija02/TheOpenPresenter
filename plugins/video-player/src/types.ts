import { PluginRendererState } from "@repo/base-plugin";

export type PluginBaseData = {
  videos: (Video | InternalVideo)[];
};

export type Video = {
  id: string;
  // This is the fallback url to play for any video
  url: string;
  isInternalVideo?: boolean;
  metadata: {
    title?: string;
    // In seconds
    duration?: number;
  };
};
// For internal video, we can provide a lot more info
export type InternalVideo = Video & {
  isInternalVideo: true;
  transcodeRequested: boolean;
  hlsMediaName: string | null;
  thumbnailMediaName: string | null;
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
  videoId: string;
  // Unique ID for the current user interaction
  // We use this to make sure that the UI is crisp
  uid?: string;
  wasPlayingBeforeSeek?: boolean | null;
  // 0 to 1
  playFrom: number;
  // UNIX Timestamp
  startedAt: number;
};
