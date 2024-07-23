export type SongCache = {
  id: string;
  title: string;
  content: string;
};

export type BaseData = {
  type: "unselected";
};

export type CustomData = {
  type: "custom";
  songIds: string[];
  songCache: SongCache[];
};

export type MyWorshipListData = BaseData | CustomData;
