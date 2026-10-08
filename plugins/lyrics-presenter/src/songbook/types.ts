import { ServerPluginApi } from "@repo/base-plugin/server";

import { PluginBaseData, PluginRendererData, Song } from "../types";

export type Api = ServerPluginApi<PluginBaseData, PluginRendererData>;

// The subset of a songbook row we need to reconcile a live doc.
export type SavedSongEntry = { song: Song };

export type RequestAuth = {
  sessionId: string | null;
  screenGuestSessionId: string | null;
};
