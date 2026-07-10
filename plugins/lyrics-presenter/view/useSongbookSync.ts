import { InternalVideo } from "@repo/video";
import { useCallback } from "react";

import { SlideStyle, Song } from "../src/types";
import { usePluginAPI } from "./pluginApi";
import { trpc } from "./trpc";

/**
 * Saves a song to the org's songbook.
 */
export const useSongbookSync = () => {
  const pluginApi = usePluginAPI();
  const pluginInfo = pluginApi.scene.useValtioData();
  const pluginId = pluginApi.pluginContext.pluginId;

  const saveMutation = trpc.lyricsPresenter.savedSongs.save.useMutation({
    onError: () => pluginApi.remote.toast.error("Failed to save to songbook"),
  });

  const saveToSongbook = useCallback(
    async (song: Song): Promise<string | undefined> => {
      const globalStyle = pluginInfo.pluginData.style as SlideStyle | undefined;

      const referencedIds = new Set<string>();
      if (song.styleOverride?.backgroundVideoMediaId) {
        referencedIds.add(song.styleOverride.backgroundVideoMediaId);
      }
      if (globalStyle?.backgroundVideoMediaId) {
        referencedIds.add(globalStyle.backgroundVideoMediaId);
      }
      const videoBackgrounds = (
        pluginInfo.pluginData.videoBackgrounds ?? []
      ).filter((v: InternalVideo) => referencedIds.has(v.id));

      const res = await saveMutation.mutateAsync({
        pluginId,
        songbookId: song.songbookId,
        song: JSON.parse(JSON.stringify(song)),
        videoBackgrounds: JSON.parse(JSON.stringify(videoBackgrounds)),
      });

      return res.id;
    },
    [
      pluginId,
      pluginInfo.pluginData.style,
      pluginInfo.pluginData.videoBackgrounds,
      saveMutation,
    ],
  );

  return { saveToSongbook, isSaving: saveMutation.isPending };
};
