import { Plugin } from "@repo/base-plugin/server";
import { logger } from "@repo/observability";

import { PluginBaseData } from "../types";
import { fetchSavedSong, fetchSavedSongsByIds } from "./db";
import { applySavedEntryToDoc } from "./reconcile";
import { getLoadedDocs } from "./registry";
import { Api } from "./types";

const uniqueSongbookIds = (data: Plugin<PluginBaseData>): string[] =>
  Array.from(
    new Set(
      data.pluginData.songs
        .map((s) => s.songbookId)
        .filter((id): id is string => !!id),
    ),
  );

// Function to align the song in yjs to match those in the songbook
export const syncSongsFromSongbook = async (
  api: Api,
  organizationId: string,
  data: Plugin<PluginBaseData>,
) => {
  try {
    const songbookIds = uniqueSongbookIds(data);
    if (songbookIds.length === 0) return;

    const byId = await fetchSavedSongsByIds(api, organizationId, songbookIds);
    for (const [songbookId, entry] of byId) {
      applySavedEntryToDoc(data, songbookId, entry);
    }
  } catch (err) {
    logger.error({ err }, "lyrics-presenter: songbook sync on load failed");
  }
};

// Open docs in the org with at least one song linked to this songbook id
const openDocsLinkedTo = (songbookId: string, organizationId: string) =>
  getLoadedDocs()
    .filter(
      ({ context, data }) =>
        context.organizationId === organizationId &&
        data.pluginData.songs.some((s) => s.songbookId === songbookId),
    )
    .map(({ data }) => data);

// When a songbook entry changes, refresh every open doc (in the same org) whose
// songs link to it
const handleSongbookNotification = async (api: Api, payload: string) => {
  let parsed: { id?: string; organizationId?: string };
  try {
    parsed = JSON.parse(payload);
  } catch {
    return;
  }
  const { id, organizationId } = parsed;
  if (!id || !organizationId) return;

  const targets = openDocsLinkedTo(id, organizationId);
  if (targets.length === 0) return;

  try {
    const entry = await fetchSavedSong(api, id, organizationId);
    if (!entry) return;
    for (const data of targets) {
      applySavedEntryToDoc(data, id, entry);
    }
  } catch (err) {
    logger.error(
      { err },
      "lyrics-presenter: songbook notification handler failed",
    );
  }
};

// Start the songbook change-listener once (idempotent)
let songbookListenerStarted = false;
export const ensureSongbookListener = (api: Api) => {
  if (songbookListenerStarted) return;
  songbookListenerStarted = true;
  try {
    api.pgListen("lyrics_presenter_songbook", (payload) => {
      void handleSongbookNotification(api, payload);
    });
  } catch (err) {
    songbookListenerStarted = false;
    logger.error(
      { err },
      "lyrics-presenter: failed to start songbook listener",
    );
  }
};
