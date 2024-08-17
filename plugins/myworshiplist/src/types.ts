export type SongCache = {
  id: number;
  title: string;
  content: string;
};

export type SlideStyle = {
  fontWeight?: string | number;
  isDarkMode?: boolean;
  padding?: number;
};

export type BaseData = {
  style?: SlideStyle;
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
