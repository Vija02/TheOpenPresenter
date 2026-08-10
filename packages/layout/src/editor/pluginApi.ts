import type { MediaPicker, PluginContext } from "@repo/base-types";
import { extractMediaName } from "@repo/lib";
import type { UniversalURL } from "@repo/lib";

import { LayoutVideo, toLayoutVideo } from "../schema/paint";

export type LayoutPluginApi = {
  mediaPicker: Pick<MediaPicker, "show">;
  pluginContext: PluginContext;
};

export const pickImage = async (
  api: LayoutPluginApi,
): Promise<UniversalURL | null> => {
  const results = await api.mediaPicker.show({
    type: "image",
    multiple: false,
    title: "Choose a picture",
    pluginContext: api.pluginContext,
  });

  const picked = results?.[0];
  if (!picked) return null;

  try {
    const { mediaId, extension } = extractMediaName(picked.mediaName);
    return { mediaId, extension };
  } catch {
    // Not an internal media name: fall back to whatever URL the host gave us.
    return picked.url;
  }
};

export const pickVideo = async (
  api: LayoutPluginApi,
): Promise<LayoutVideo | null> => {
  const results = await api.mediaPicker.show({
    type: "video",
    multiple: false,
    title: "Choose a video",
    pluginContext: api.pluginContext,
  });

  const picked = results?.[0];
  if (!picked?.internalVideo) return null;

  return toLayoutVideo(picked.internalVideo);
};
