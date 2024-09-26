import { z } from "zod";

export type SongCache = {
  id: number;
  title: string;
  content: string;
};

export type Song = {
  id: number;
  cachedData?: SongCache;
  modifiedContent?: string;
  setting: SongSetting;
};

export type MyWorshipListData = {
  style?: SlideStyle;
  songs: Song[];
};

export const slideStyleValidator = z.object({
  fontWeight: z.string().or(z.number()).optional(),
  isDarkMode: z.boolean().optional(),
  padding: z.number().optional(),
});
export type SlideStyle = z.infer<typeof slideStyleValidator>;

export const displayTypes = ["sections", "fullSong"] as const;
export type DisplayType = (typeof displayTypes)[number];
export const displayTypeSettings: Record<DisplayType, { label: string }> = {
  sections: {
    label: "Sections",
  },
  fullSong: {
    label: "Full Song",
  },
};
export const songSettingValidator = z.object({
  displayType: z.enum(displayTypes),
});
export type SongSetting = z.infer<typeof songSettingValidator>;

export type PluginRendererData = { songId: number; heading: string };
