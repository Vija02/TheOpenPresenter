import { Plugin } from "@repo/base-plugin/server";

import { PluginBaseData, Song } from "../types";
import { SavedSongEntry } from "./types";

// Copy changed fields from a saved songbook entry onto a live (possibly stale)
// scene song. Only assigns fields that actually differ
const reconcileLinkedSong = (song: Song, saved: Song) => {
  if (song.title !== saved.title) song.title = saved.title;
  if (song.content !== saved.content) song.content = saved.content;
  if ((song.author ?? null) !== (saved.author ?? null)) {
    song.author = saved.author ?? null;
  }
  if ((song.album ?? null) !== (saved.album ?? null)) {
    song.album = saved.album ?? null;
  }
  if (JSON.stringify(song.setting) !== JSON.stringify(saved.setting)) {
    song.setting = saved.setting;
  }
  if (JSON.stringify(song.looks ?? {}) !== JSON.stringify(saved.looks ?? {})) {
    song.looks = saved.looks ?? {};
  }
};

export const applySavedEntryToDoc = (
  data: Plugin<PluginBaseData>,
  songbookId: string,
  entry: SavedSongEntry,
) => {
  for (const song of data.pluginData.songs) {
    if (song.songbookId === songbookId) reconcileLinkedSong(song, entry.song);
  }
};
