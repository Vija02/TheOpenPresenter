import { LAYOUT_VIDEO_STATES_KEY } from "@repo/base-types";
import type { LayoutVideoStates } from "@repo/layout";
import { z } from "zod";

import type { LookMap, SongLook } from "./looks";

export type ImportedData = {
  title: string;
  author: string | null;
  content: string;
  original_chord: string;
  [key: string]: unknown;
};

type ImportSettingBase = {
  importedData?: ImportedData;
};

export type MyWorshipListImportSetting = ImportSettingBase & {
  type: "myworshiplist";
  meta: { id: number };
};

export type PlanningCenterImportSetting = ImportSettingBase & {
  type: "planningCenter";
  meta: { songId: string; arrangementId: string };
};

export type ChurchSuiteImportSetting = ImportSettingBase & {
  type: "churchSuite";
  meta: { songId: string; arrangementId: string };
};

export type ImportSetting =
  | MyWorshipListImportSetting
  | PlanningCenterImportSetting
  | ChurchSuiteImportSetting;

export type ImportSource = ImportSetting["type"];

export type Song = {
  id: string;
  title: string;
  content: string;
  author?: string | null;
  album?: string | null;
  /** The base key */
  key?: string | null;
  setting: SongSetting;
  /** The song's own versions of looks, by key. Missing ones follow the org */
  looks: Record<string, SongLook>;

  songbookId?: string;

  _imported: boolean;
  // If this exist then this song is imported.
  import?: ImportSetting;
};

export type PluginBaseData = {
  songs: Song[];
  /** READ-ONLY CACHE of the organization's looks, by key. Server synced. For easy access. */
  looks: LookMap;
};

// A saved-song library row
export type SavedSong = {
  id: string;
  title: string;
  author: string | null;
  album: string | null;
  source: string;
  externalId: string | null;
  song: Song;
  createdAt: string;
  updatedAt: string;
};

export const displayTypes = ["sections", "fullSong"] as const;
export type DisplayType = (typeof displayTypes)[number];
export const displayTypeSettings: Record<
  DisplayType,
  { label: string; description: string }
> = {
  sections: {
    label: "Sections",
    description: "Show lyrics in sections",
  },
  fullSong: {
    label: "Full Song",
    description: "Show all in one screen",
  },
};
export const songSettingValidator = z.object({
  displayType: z.enum(displayTypes),
  sectionOrder: z.array(z.string()).nullable().optional(),
});
export type SongSetting = z.infer<typeof songSettingValidator>;

export type BackgroundRun = {
  key: string;
  /** Epoch ms the run started. Drives the background's playback */
  since: number;
};

export type PluginRendererData = {
  songId: string | null;
  currentIndex: number | null;
  /** Only written by `activateLyricSlide`. Missing on older renderer data */
  backgroundRun: BackgroundRun | null;
  [LAYOUT_VIDEO_STATES_KEY]?: LayoutVideoStates;
};
