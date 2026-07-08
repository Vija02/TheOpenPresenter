import { Plugin } from "@repo/base-plugin/server";
import { InternalVideo } from "@repo/video";

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
  if (
    JSON.stringify(song.styleOverride ?? null) !==
    JSON.stringify(saved.styleOverride ?? null)
  ) {
    song.styleOverride = saved.styleOverride ?? null;
  }
};

// Append any incoming video backgrounds the doc doesn't already have
const addMissingVideoBackgrounds = (
  existing: InternalVideo[],
  incoming: InternalVideo[],
) => {
  const existingIds = new Set(existing.map((v) => v.id));
  for (const vb of incoming) {
    if (vb && !existingIds.has(vb.id)) existing.push(vb);
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
  addMissingVideoBackgrounds(
    data.pluginData.videoBackgrounds,
    entry.videoBackgrounds,
  );
};
