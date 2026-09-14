import { ImportSetting } from "../../../../src";

export type SetlistSong = {
  key: string;
  title: string;
  author: string | null;
  matchSource: string;
  matchExternalId: string | null;
  /** Recorded onto the song so later edits know where it came from. */
  importSetting: ImportSetting;
};

export type Setlist = {
  source: "myworshiplist" | "planningCenter";
  id: string;
  title: string;
  /** Service type, date, or whatever else identifies the setlist. */
  subtitle: string | null;
  /** Which Planning Center connection the lyrics must be fetched through */
  connectionId?: string;
  content: SetlistSong[];
};

export const setlistSourceLabel: Record<Setlist["source"], string> = {
  myworshiplist: "MyWorshipList",
  planningCenter: "Planning Center",
};
