import { PluginAPIContext } from "@repo/base-plugin/client";
import { createContext, useContext } from "react";

/**
 * How video fills behave in this part of the tree
 */
export type VideoFillMode = "live" | "poster";

/**
 * `null` means "nobody asked", which is deliberately distinct from an explicit
 * "live": it lets the surface decide the default while still allowing a subtree
 * (the editing canvas) to override it.
 */
export const VideoFillModeContext = createContext<VideoFillMode | null>(null);

/**
 * Resolves to an explicit override if one is in scope, otherwise defaults by
 * surface: the remote shows every scene at once, so a video fill per preview
 * would mean a dozen decoders driving postage stamps. The renderer is the single
 * live output and plays.
 *
 * The surface arrives via `pluginAPI` rather than context because plugin views
 * mount as web components (@r2wc) with their own React root, and context does
 * not cross that boundary — but props do.
 */
export const useVideoFillMode = (): VideoFillMode => {
  const override = useContext(VideoFillModeContext);
  const { pluginAPI } = useContext(PluginAPIContext);

  if (override) return override;

  return pluginAPI?.surface === "remote" ? "poster" : "live";
};
