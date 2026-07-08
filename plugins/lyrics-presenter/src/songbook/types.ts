import { ServerPluginApi } from "@repo/base-plugin/server";
import { InternalVideo } from "@repo/video";

import { PluginBaseData, PluginRendererData, Song } from "../types";

export type Api = ServerPluginApi<PluginBaseData, PluginRendererData>;

// The subset of a songbook row we need to reconcile a live doc.
export type SavedSongEntry = { song: Song; videoBackgrounds: InternalVideo[] };
