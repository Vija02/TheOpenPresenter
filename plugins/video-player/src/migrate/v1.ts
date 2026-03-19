/**
 * Migration from v1 (old format) to v2 (new format)
 *
 * Renderer Data:
 *   Old format: { currentPlayingVideo, videoSeeks, isPlaying, volume }
 *   New format: { videoStates: Record<string, VideoPlaybackState> }
 *
 * Plugin Data (videos array):
 *   Old format: InternalVideo had `transcodeRequested: boolean`
 *   New format: InternalVideo no longer has `transcodeRequested`
 */
import { ObjectToTypedMap, Plugin } from "@repo/base-plugin/server";
import { TypedMap } from "@repo/lib";
import { logger } from "@repo/observability";
import * as Y from "yjs";

import { PluginBaseData, PluginRendererData } from "../types";

// ============================================
// Legacy Types (v1 format)
// ============================================

/**
 * @deprecated Old format - use VideoPlaybackState from @repo/video instead
 */
export type LegacyCurrentPlayingVideo = {
  videoId: string;
  uid?: string;
  wasPlayingBeforeSeek?: boolean | null;
  playFrom: number;
  startedAt: number;
};

/**
 * @deprecated Old format - use PluginRendererData instead
 */
export type LegacyRendererData = {
  currentPlayingVideo: LegacyCurrentPlayingVideo | null;
  videoSeeks: Record<string, number>;
  isPlaying: boolean;
  volume: number;
};

/**
 * @deprecated Old format - InternalVideo used to have transcodeRequested
 */
export type LegacyInternalVideo = {
  id: string;
  url: string;
  isInternalVideo: true;
  transcodeRequested: boolean;
  hlsMediaName: string | null;
  thumbnailMediaName: string | null;
  metadata: {
    title?: string;
    duration?: number;
    thumbnailUrl?: string;
  };
};

// ============================================
// Migration Logic
// ============================================

/**
 * Migrates renderer data from v1 format to v2 format.
 * Safe to call on data that's already migrated - it will be a no-op.
 *
 * @param rendererData The Yjs map containing renderer data
 * @returns true if migration was performed, false if already in new format
 */
export const migrateRendererDataV1ToV2 = (
  rendererData: ObjectToTypedMap<PluginRendererData>,
): boolean => {
  const rawData = rendererData as Y.Map<any>;

  // Check if we have old format data
  const hasOldFormat =
    rawData.has("currentPlayingVideo") ||
    rawData.has("videoSeeks") ||
    rawData.has("isPlaying");
  const hasNewFormat = rawData.has("videoStates");

  if (hasOldFormat && !hasNewFormat) {
    logger.info(
      "Migrating video-player renderer data from old format to new format",
    );

    // Get old data
    const oldCurrentPlayingVideo =
      rawData.get("currentPlayingVideo")?.toJSON?.() ??
      rawData.get("currentPlayingVideo");
    const oldVideoSeeks =
      rawData.get("videoSeeks")?.toJSON?.() ?? rawData.get("videoSeeks") ?? {};
    const oldIsPlaying = rawData.get("isPlaying") ?? false;
    const oldVolume = rawData.get("volume") ?? 1;

    // Create new videoStates map
    const videoStates = new Y.Map<any>();

    // Migrate each video's seek position to a VideoPlaybackState
    if (oldVideoSeeks && typeof oldVideoSeeks === "object") {
      for (const [videoId, seek] of Object.entries(oldVideoSeeks)) {
        const videoStateMap = new Y.Map<any>();
        videoStateMap.set("uid", Math.random().toString());
        videoStateMap.set("isPlaying", false);
        videoStateMap.set("volume", oldVolume);
        videoStateMap.set("seek", seek as number);
        videoStateMap.set("startedAt", Date.now());
        videoStates.set(videoId, videoStateMap);
      }
    }

    // If there's a currently playing video, update its state
    if (oldCurrentPlayingVideo && oldCurrentPlayingVideo.videoId) {
      const videoId = oldCurrentPlayingVideo.videoId;
      let videoStateMap = videoStates.get(videoId) as Y.Map<any> | undefined;

      if (!videoStateMap) {
        videoStateMap = new Y.Map<any>();
        videoStates.set(videoId, videoStateMap);
      }

      videoStateMap.set(
        "uid",
        oldCurrentPlayingVideo.uid ?? Math.random().toString(),
      );
      videoStateMap.set("isPlaying", oldIsPlaying);
      videoStateMap.set("volume", oldVolume);
      videoStateMap.set("seek", oldCurrentPlayingVideo.playFrom ?? 0);
      videoStateMap.set(
        "startedAt",
        oldCurrentPlayingVideo.startedAt ?? Date.now(),
      );
    }

    // Set new format data
    rendererData.set("activeVideoId", oldCurrentPlayingVideo?.videoId ?? null);
    rendererData.set("videoStates", videoStates as TypedMap<any>);

    // Delete old format data
    rawData.delete("currentPlayingVideo");
    rawData.delete("videoSeeks");
    rawData.delete("isPlaying");
    rawData.delete("volume");
    rawData.delete("currentVideoId"); // Also clean up intermediate format if present

    logger.info("Migration complete");
    return true;
  } else if (!hasNewFormat) {
    // No data at all, initialize new format
    rendererData.set("activeVideoId", null);
    rendererData.set("videoStates", new Y.Map<any>() as TypedMap<any>);
    return false;
  }

  // Ensure activeVideoId exists for existing data that was migrated before this field was added
  if (!rawData.has("activeVideoId")) {
    rendererData.set("activeVideoId", null);
  }

  return false;
};

/**
 * Migrates plugin data (videos array) from v1 format to v2 format.
 * Removes the deprecated `transcodeRequested` field from InternalVideo entries.
 * Safe to call on data that's already migrated - it will be a no-op.
 *
 * @param pluginInfo The Yjs map containing plugin info
 * @returns true if migration was performed, false if already in new format
 */
export const migratePluginDataV1ToV2 = (
  pluginInfo: ObjectToTypedMap<Plugin<PluginBaseData>>,
): boolean => {
  const pluginData = pluginInfo.get("pluginData");
  if (!pluginData) {
    return false;
  }

  const videos = pluginData.get("videos") as Y.Array<any> | undefined;
  if (!videos || videos.length === 0) {
    return false;
  }

  let migrated = false;

  // Check each video for the old transcodeRequested field
  for (let i = 0; i < videos.length; i++) {
    const video = videos.get(i) as Y.Map<any>;
    if (video && video.has && video.has("transcodeRequested")) {
      logger.info(
        { videoIndex: i },
        "Migrating video-player plugin data: removing transcodeRequested field",
      );
      video.delete("transcodeRequested");
      migrated = true;
    }
  }

  if (migrated) {
    logger.info("Plugin data migration complete");
  }

  return migrated;
};
