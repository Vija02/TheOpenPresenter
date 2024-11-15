import { z } from "zod";

export type MyWorshipListImportSetting = {
  type: "myworshiplist";
  meta: { id: number };
  importedData?: MyWorshipListImportedData;
};
export type MyWorshipListImportedData = {
  id: number;
  title: string;
  author: string | null;
  year: number | null;
  content: string;
  original_chord: string;
};

export type Song = {
  id: string;
  title: string;
  content: string;
  author?: string | null;
  album?: string | null;
  setting: SongSetting;

  _imported: boolean;
  // If this exist then this song is imported.
  import?: MyWorshipListImportSetting;
};

export type PluginBaseData = {
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

export type PluginRendererData = {
  songId: string | null;
  currentIndex: number | null;
};
