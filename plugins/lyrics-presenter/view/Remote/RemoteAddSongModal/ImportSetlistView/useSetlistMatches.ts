import { useMemo } from "react";

import { SavedSong } from "../../../../src";
import { usePluginAPI } from "../../../pluginApi";
import { trpc } from "../../../trpc";

export const useSetlistMatches = () => {
  const pluginApi = usePluginAPI();
  const pluginId = pluginApi.pluginContext.pluginId;

  const savedSongsQuery = trpc.lyricsPresenter.savedSongs.list.useQuery({
    // TODO: Update to orgId
    pluginId,
  });

  const matchesByMwlId = useMemo(() => {
    const map = new Map<string, SavedSong[]>();
    for (const saved of savedSongsQuery.data ?? []) {
      if (saved.source === "myworshiplist" && saved.externalId) {
        const arr = map.get(saved.externalId) ?? [];
        arr.push(saved);
        map.set(saved.externalId, arr);
      }
    }
    return map;
  }, [savedSongsQuery.data]);

  return { isLoading: savedSongsQuery.isLoading, matchesByMwlId };
};
