import { z } from "zod";

export type SongCache = {
  id: number;
  title: string;
  content: string;
};

export type BaseData = {
  style?: SlideStyle;
  type: string;
};

export type UnselectedTypeData = BaseData & {
  type: "unselected";
};

export type CustomTypeData = BaseData & {
  type: "custom";
  songIds: number[];
  songCache: SongCache[];
};

export type MyWorshipListData = UnselectedTypeData | CustomTypeData;

export const slideStyleValidator = z.object({
  fontWeight: z.string().or(z.number()).optional(),
  isDarkMode: z.boolean().optional(),
  padding: z.number().optional(),
});
export type SlideStyle = z.infer<typeof slideStyleValidator>;

export type PluginRendererData = { songId: number; heading: string };
