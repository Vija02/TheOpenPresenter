export type SongCache = {
  id: number;
  title: string;
  content: string;
};

export type BaseData = {
  type: "unselected";
};

export type CustomData = {
  type: "custom";
  songIds: number[];
  songCache: SongCache[];
};

export type MyWorshipListData = BaseData | CustomData;
