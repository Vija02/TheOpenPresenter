import { PluginAPIContext } from "@repo/base-plugin/client";
import { LAYOUT_VIDEO_STATES_KEY, VIDEO_VOLUME_KEY } from "@repo/base-types";
import type { VideoPlaybackState } from "@repo/video";
import { createContext, useContext } from "react";

import type { VideoFillKey } from "../../doc/edit";
import { videoFillKey } from "../../doc/edit";
import type { LayoutVideoStates } from "../../doc/videoState";

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

/** The plugin's output level for its videos */
export const useVideoFillOutputVolume = (): number => {
  const { pluginAPI } = useContext(PluginAPIContext);

  const volume = pluginAPI?.renderer.useData(
    (x: Record<string, unknown>) => x[VIDEO_VOLUME_KEY] as number | undefined,
  );

  return volume ?? 1;
};

/** Pass down scope */
export const VideoFillScopeContext = createContext<string>("");

export const useVideoFillScope = (): string =>
  useContext(VideoFillScopeContext);
