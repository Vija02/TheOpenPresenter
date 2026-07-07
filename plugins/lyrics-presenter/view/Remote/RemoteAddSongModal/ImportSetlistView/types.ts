import { SavedSong } from "../../../../src";

export type SetlistChoice =
  | { mode: "match"; savedSong: SavedSong }
  | { mode: "import"; saveToSongbook: boolean };
