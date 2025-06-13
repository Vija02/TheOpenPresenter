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

const paddingValidator = z
  .string()
  .or(z.number())
  .transform((x) => {
    const num = parseFloat(x.toString());
    return Number.isNaN(num) ? 0 : num;
  })
  .optional();
export const slideStyleValidator = z.object({
  autoSize: z.boolean().optional(),
  fontSize: z.string().or(z.number()).optional(),
  fontWeight: z.string().or(z.number()).optional(),
  fontStyle: z.string().optional(),
  fontFamily: z.string().optional(),
  lineHeight: z
    .string()
    .or(z.number())
    .transform((x) => {
      const num = parseFloat(x.toString());
      return Number.isNaN(num) ? 1 : num;
    })
    .optional(),
  isDarkMode: z.boolean().optional(),
  padding: paddingValidator,
  paddingIsLinked: z.boolean().optional(),
  leftPadding: paddingValidator,
  topPadding: paddingValidator,
  rightPadding: paddingValidator,
  bottomPadding: paddingValidator,
  debugPadding: z.boolean().optional(),
});
export type SlideStyle = z.infer<typeof slideStyleValidator>;

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
});
export type SongSetting = z.infer<typeof songSettingValidator>;

export type PluginRendererData = {
  songId: string | null;
  currentIndex: number | null;
};
