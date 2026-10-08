import type { LayoutDoc, Template } from "@repo/layout";
import { hash } from "ohash";

import {
  type Background,
  type KeyedBackground,
  type ResolvedBackground,
  backgroundFromMedia,
  keyBackground,
} from "./backgrounds";
import {
  fullSongTemplates,
  lowerThirdTemplates,
  mainTemplates,
} from "./template/presets";
import type { Song } from "./types";

/**
 * A look is a layout for one purpose, like main slides or a lower third: a
 * text template and the background under it. Looks are the organization's,
 * and a song can have its own version of any of them
 */
export type Look = {
  /** Stable. A built-in's, or generated for one the organization made */
  key: string;
  name: string;
  position: number;
  template: LayoutDoc;
  /** Null is no background */
  background: Background | null;
};

/**
 * A song's own version of a look. Null follows the organization's. A song
 * shows no background over the look's with `NO_BACKGROUND`
 */
export type SongLook = {
  template: LayoutDoc | null;
  background: Background | null;
};

export const MAIN_LOOK = "main";
export const FULL_SONG_LOOK = "fullSong";
export const LOWER_THIRD_LOOK = "lowerThird";

const BLACK: Background = backgroundFromMedia({
  type: "solid",
  color: "#000000",
});

/** What every organization starts with, until it edits them */
export const BUILT_IN_LOOKS: readonly Look[] = [
  {
    key: MAIN_LOOK,
    name: "Main",
    position: 0,
    template: mainTemplates[0]!.doc,
    background: BLACK,
  },
  {
    key: FULL_SONG_LOOK,
    name: "Full song",
    position: 1,
    template: fullSongTemplates[0]!.doc,
    background: BLACK,
  },
  {
    key: LOWER_THIRD_LOOK,
    name: "Lower third",
    position: 2,
    template: lowerThirdTemplates[0]!.doc,
    // Over other content, so nothing behind it
    background: null,
  },
];

const PRESETS: Record<string, Template[]> = {
  [MAIN_LOOK]: mainTemplates,
  [FULL_SONG_LOOK]: fullSongTemplates,
  [LOWER_THIRD_LOOK]: lowerThirdTemplates,
};

/** The presets to start a look from. The organization's own get main's */
export const presetsForLook = (key: string): Template[] =>
  PRESETS[key] ?? mainTemplates;

export const builtInLook = (key: string): Look | null =>
  BUILT_IN_LOOKS.find((look) => look.key === key) ?? null;

/** The organization's looks, as a scene holds them. By key */
export type LookMap = Record<string, Look>;

/** Every look there is: the built-ins, as edited, then the organization's */
export const listLooks = (looks: LookMap | null | undefined): Look[] => {
  const byKey = new Map<string, Look>();
  for (const look of BUILT_IN_LOOKS) byKey.set(look.key, look);
  for (const look of Object.values(looks ?? {})) byKey.set(look.key, look);
  return [...byKey.values()].sort((a, b) => a.position - b.position);
};

/** The organization's, else the built-in. Main for a look that's gone */
export const resolveLook = (
  looks: LookMap | null | undefined,
  key: string,
): Look =>
  looks?.[key] ??
  builtInLook(key) ??
  looks?.[MAIN_LOOK] ??
  builtInLook(MAIN_LOOK)!;

/** Which look a song shows in by default */
export const lookKeyFor = (song: Pick<Song, "setting">): string =>
  song.setting.displayType === "fullSong" ? FULL_SONG_LOOK : MAIN_LOOK;

/** Missing on songs from before looks */
export const songLook = (
  song: Pick<Song, "looks">,
  key: string,
): SongLook | null => song.looks?.[key] ?? null;

export const songLookTemplate = (
  song: Pick<Song, "looks">,
  key: string,
  looks: LookMap | null | undefined,
): LayoutDoc =>
  songLook(song, key)?.template ?? resolveLook(looks, key).template;

export const songLookBackground = (
  song: Pick<Song, "looks">,
  key: string,
  looks: LookMap | null | undefined,
): Background | null =>
  songLook(song, key)?.background ?? resolveLook(looks, key).background;

/** The song's own, else its look's. Every slide of a song shows it */
export const resolveSongBackground = (
  song: Pick<Song, "looks" | "setting">,
  looks: LookMap | null | undefined,
  key: string = lookKeyFor(song),
): ResolvedBackground => keyBackground(songLookBackground(song, key, looks));

/** Everything the output may need to show, to preload */
export const resolveSceneBackgrounds = (
  songs: Pick<Song, "looks" | "setting">[],
  looks: LookMap | null | undefined,
): KeyedBackground[] => {
  const seen = new Map<string, KeyedBackground>();
  for (const song of songs) {
    const entry = resolveSongBackground(song, looks);
    if (entry && !seen.has(entry.key)) seen.set(entry.key, entry);
  }
  return [...seen.values()];
};

export const sameTemplate = (a: LayoutDoc, b: LayoutDoc) => hash(a) === hash(b);

/**
 * By what shows, so the same media picked again counts as the same, and an
 * explicit none as none
 */
export const sameBackground = (a: Background | null, b: Background | null) =>
  (keyBackground(a)?.key ?? null) === (keyBackground(b)?.key ?? null);

export const sameLayout = (
  a: Pick<Look, "template" | "background">,
  b: Pick<Look, "template" | "background">,
) =>
  sameTemplate(a.template, b.template) &&
  sameBackground(a.background, b.background);
