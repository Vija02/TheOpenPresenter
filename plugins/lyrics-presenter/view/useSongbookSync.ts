import { useCallback } from "react";

import { Song } from "../src/types";
import { usePluginAPI } from "./pluginApi";
import { trpc } from "./trpc";

/**
 * Saves a song to the org's songbook.
 */
export const useSongbookSync = () => {
  const pluginApi = usePluginAPI();
  const pluginId = pluginApi.pluginContext.pluginId;
  const isPublicAccess = pluginApi.isPublicAccess;

  const saveMutation = trpc.lyricsPresenter.savedSongs.save.useMutation({
    onError: () => pluginApi.remote.toast.error("Failed to save to songbook"),
  });

  const saveToSongbook = useCallback(
    async (song: Song): Promise<string | undefined> => {
      if (isPublicAccess) return undefined;

      const res = await saveMutation.mutateAsync({
        pluginId,
        songbookId: song.songbookId,
        song: JSON.parse(JSON.stringify(song)),
      });

      return res.id;
    },
    [isPublicAccess, pluginId, saveMutation],
  );

  return { saveToSongbook, isSaving: saveMutation.isPending };
};
