import { SavedSong } from "../../../../src";

export type SetlistImportData = {
  title: string;
  author: string | null;
  content: string;
  originalContent: string;
};

export type SetlistChoice =
  | { mode: "match"; savedSong: SavedSong }
  | { mode: "import"; saveToSongbook: boolean; data?: SetlistImportData };
