import { PluginAPIContext } from "@repo/base-plugin/client";
import { createContext, useContext } from "react";

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
