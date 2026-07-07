import { useOverlayToggle } from "@repo/ui";
import { useCallback } from "react";
import { typeidUnboxed } from "typeid-js";

import { SavedSong, Song } from "../../../src";
import { usePluginAPI } from "../../pluginApi";
import { useSongbookSync } from "../../useSongbookSync";

export const useAddSongScene = () => {
  const pluginApi = usePluginAPI();
  const pluginInfo = pluginApi.scene.useValtioData();
  const { saveToSongbook } = useSongbookSync();
  const { onToggle, resetData } = useOverlayToggle();

  const close = useCallback(() => {
    onToggle?.();
    resetData?.();
  }, [onToggle, resetData]);

  // Add an already-saved songbook song to the scene (linked), restoring its
  // referenced video backgrounds (dedupe by id)
  const addLinkedSavedSong = useCallback(
    (saved: SavedSong) => {
      const existing = pluginInfo.pluginData.videoBackgrounds;
      const existingIds = new Set(existing.map((v) => v.id));
      for (const vb of saved.videoBackgrounds ?? []) {
        if (vb && !existingIds.has(vb.id)) {
          existing.push(vb);
        }
      }
      pluginInfo.pluginData.songs.push({
        ...saved.song,
        id: typeidUnboxed(),
        songbookId: saved.id,
      });
    },
    [pluginInfo],
  );

  // Push a song to the scene. When `save` is set, also save it to the songbook
  // client-side and link the resulting id back onto the song
  const addSong = useCallback(
    (song: Song, save: boolean) => {
      pluginInfo.pluginData.songs.push(song);
      if (save) {
        void saveToSongbook(song).then((id) => {
          if (!id) return;
          const idx = pluginInfo.pluginData.songs.findIndex(
            (s) => s.id === song.id,
          );
          if (idx >= 0) pluginInfo.pluginData.songs[idx]!.songbookId = id;
        });
      }
    },
    [pluginInfo, saveToSongbook],
  );

  return { close, addLinkedSavedSong, addSong };
};
