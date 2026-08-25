import {
  LAYOUT_VIDEO_STATES_KEY,
  VIDEO_VOLUME_KEY,
  type VideoPlaybackState,
} from "@repo/base-types";

import type { PluginAPI } from "../Slide/types";
import { VolumeBar } from "./VolumeBar";

/**
 * Volume bar for layout video playback
 */
export const VideoVolumeBar = ({ pluginAPI }: { pluginAPI: PluginAPI }) => {
  const videoStates = pluginAPI.renderer.useData(
    (x: Record<string, unknown>) =>
      x[LAYOUT_VIDEO_STATES_KEY] as
        | Record<string, VideoPlaybackState>
        | undefined,
  );
  const volume = pluginAPI.renderer.useData(
    (x: Record<string, unknown>) => x[VIDEO_VOLUME_KEY] as number | undefined,
  );
  const mutableRendererData =
    pluginAPI.renderer.useValtioData<Record<string, unknown>>();

  // Only show if there's any video playing
  if (!videoStates || Object.keys(videoStates).length === 0) return null;

  return (
    <VolumeBar
      volume={volume ?? 1}
      onChange={(v) => {
        mutableRendererData[VIDEO_VOLUME_KEY] = v;
      }}
    />
  );
};
