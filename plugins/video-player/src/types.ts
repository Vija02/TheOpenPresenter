import { PluginRendererState } from "@repo/base-plugin";
import { UniversalVideo, VideoPlaybackState } from "@repo/video";

export type PluginBaseData = {
  videos: UniversalVideo[];
};

export type PluginRendererData = PluginRendererState & {
  activeVideoId: string | null;
  videoStates: Record<string, VideoPlaybackState>;
};
