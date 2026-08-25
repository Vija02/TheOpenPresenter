import { PluginAPIContext } from "@repo/base-plugin/client";
import type { VideoPlaybackState } from "@repo/video";
import { createContext, useContext } from "react";

import type { VideoFillKey } from "../../doc/edit";
import { LAYOUT_VIDEO_STATES_KEY, videoFillKey } from "../../doc/edit";

/**
 * How video fills behave in this part of the tree
 */
export type VideoFillMode = "live" | "poster";

export const VideoFillModeContext = createContext<VideoFillMode | null>(null);

export const useVideoFillMode = (): VideoFillMode => {
  const override = useContext(VideoFillModeContext);
  const { pluginAPI } = useContext(PluginAPIContext);

  if (override) return override;

  return pluginAPI?.surface === "remote" ? "poster" : "live";
};

/** Playback state for one video fill, as stored by the host plugin */
export type VideoFillPlaybackState = VideoPlaybackState;
export type LayoutVideoStates = Record<string, VideoFillPlaybackState>;

export const useVideoFillPlaybackState = (
  key: VideoFillKey,
): VideoFillPlaybackState | undefined => {
  const { pluginAPI } = useContext(PluginAPIContext);

  const states = pluginAPI?.renderer.useData(
    (x: Record<string, unknown>) =>
      x[LAYOUT_VIDEO_STATES_KEY] as LayoutVideoStates | undefined,
  );

  return states?.[videoFillKey(key)];
};

/** Pass down scope */
export const VideoFillScopeContext = createContext<string>("");

export const useVideoFillScope = (): string =>
  useContext(VideoFillScopeContext);
