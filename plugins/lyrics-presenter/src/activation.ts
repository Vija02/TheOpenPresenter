import {
  type VideoStateTarget,
  activateVideoFills,
  valtioVideoStateTarget,
  yjsVideoStateTarget,
} from "@repo/layout";

import { type ResolvedBackground, resolveSongBackground } from "./backgrounds";
import { sceneBackground } from "./template/layout";
import type {
  BackgroundRun,
  PluginBaseData,
  PluginRendererData,
} from "./types";

/** Each background's video fills are keyed under this scope */
export const backgroundScope = (key: string) => `bg:${key}`;

export type LyricsSceneData = Pick<PluginBaseData, "songs" | "background">;

export const resolveLiveBackground = (
  pluginData: LyricsSceneData,
  songId: string | null,
  index: number | null,
): ResolvedBackground => {
  const song = pluginData.songs.find((x) => x.id === songId);
  if (!song) return null;
  // Nothing is showing. Full song shows whatever the index says
  if (index === null && song.setting.displayType !== "fullSong") return null;

  return resolveSongBackground(song, sceneBackground(pluginData));
};

// Adapter
export type LyricsActivationTarget = VideoStateTarget & {
  setSongId: (songId: string | null) => void;
  setCurrentIndex: (index: number | null) => void;
  getBackgroundRun: () => BackgroundRun | null;
  setBackgroundRun: (run: BackgroundRun | null) => void;
};

export type ActivateLyricSlideOptions = {
  now?: number;
};

export const activateLyricSlide = (
  target: LyricsActivationTarget,
  pluginData: LyricsSceneData,
  songId: string | null,
  index: number | null,
  { now = Date.now() }: ActivateLyricSlideOptions = {},
): void => {
  target.setSongId(songId);
  target.setCurrentIndex(index);

  const resolved = resolveLiveBackground(pluginData, songId, index);
  const run = target.getBackgroundRun();

  if ((resolved?.key ?? null) === (run?.key ?? null)) return;

  target.setBackgroundRun(resolved ? { key: resolved.key, since: now } : null);
  activateVideoFills(
    target,
    resolved
      ? [{ scope: backgroundScope(resolved.key), doc: resolved.background }]
      : [],
    now,
  );
};

export const valtioLyricsActivationTarget = (
  mutableRendererData: PluginRendererData,
): LyricsActivationTarget => ({
  ...valtioVideoStateTarget(mutableRendererData),
  setSongId: (songId) => {
    mutableRendererData.songId = songId;
  },
  setCurrentIndex: (index) => {
    mutableRendererData.currentIndex = index;
  },
  getBackgroundRun: () => mutableRendererData.backgroundRun ?? null,
  setBackgroundRun: (run) => {
    mutableRendererData.backgroundRun = run;
  },
});

/** Callers are expected to already be inside `doc.transact()` */
export const yjsLyricsActivationTarget = (rendererData: {
  get: (key: any) => any;
  set: (key: any, value: any) => any;
}): LyricsActivationTarget => ({
  ...yjsVideoStateTarget(rendererData),
  setSongId: (songId) => {
    rendererData.set("songId", songId);
  },
  setCurrentIndex: (index) => {
    rendererData.set("currentIndex", index);
  },
  getBackgroundRun: () => {
    const raw = rendererData.get("backgroundRun");
    if (!raw) return null;
    // Y.Map when it came off the wire, plain object when we just wrote it
    return typeof raw.toJSON === "function"
      ? (raw.toJSON() as BackgroundRun)
      : (raw as BackgroundRun);
  },
  setBackgroundRun: (run) => {
    rendererData.set("backgroundRun", run);
  },
});
