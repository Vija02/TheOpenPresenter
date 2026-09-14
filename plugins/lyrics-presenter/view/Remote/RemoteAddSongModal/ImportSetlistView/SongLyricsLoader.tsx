import { useEffect } from "react";

import { trpc } from "../../../trpc";
import { SetlistSong } from "../MainView/setlistTypes";
import { SetlistImportData } from "./types";

export const SongLyricsLoader = ({
  song,
  connectionId,
  pluginId,
  onLoaded,
}: {
  song: SetlistSong;
  connectionId: string | undefined;
  pluginId: string;
  onLoaded: (data: SetlistImportData) => void;
}) => {
  const isMwl = song.importSetting.type === "myworshiplist";

  const mwlQuery = trpc.lyricsPresenter.myworshiplist.getSong.useQuery(
    {
      id:
        song.importSetting.type === "myworshiplist"
          ? song.importSetting.meta.id
          : 0,
    },
    { enabled: isMwl },
  );

  const pcoQuery = trpc.lyricsPresenter.planningCenter.getSong.useQuery(
    {
      pluginId,
      connectionId: connectionId ?? "",
      songId:
        song.importSetting.type === "planningCenter"
          ? song.importSetting.meta.songId
          : "",
      arrangementId:
        song.importSetting.type === "planningCenter"
          ? song.importSetting.meta.arrangementId
          : "",
      title: song.title,
      author: song.author,
    },
    { enabled: !isMwl && !!connectionId },
  );

  const data = isMwl ? mwlQuery.data : pcoQuery.data;

  useEffect(() => {
    if (!data) return;
    onLoaded({
      title: data.title || song.title,
      author: data.author ?? song.author,
      content: data.content,
      originalContent: data.content,
    });
  }, [data, onLoaded, song.title, song.author]);

  return null;
};
