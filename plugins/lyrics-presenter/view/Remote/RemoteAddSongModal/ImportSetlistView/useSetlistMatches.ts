import { useMemo } from "react";

import { SavedSong } from "../../../../src";
import { usePluginAPI } from "../../../pluginApi";
import { trpc } from "../../../trpc";

export const useSetlistMatches = () => {
  const pluginApi = usePluginAPI();
  const pluginId = pluginApi.pluginContext.pluginId;
  const isPublicAccess = pluginApi.isPublicAccess;

  const savedSongsQuery = trpc.lyricsPresenter.savedSongs.list.useQuery(
    {
      // TODO: Update to orgId
      pluginId,
    },
    { enabled: !isPublicAccess },
  );

  const matchesByKey = useMemo(() => {
    const map = new Map<string, SavedSong[]>();
    for (const saved of savedSongsQuery.data ?? []) {
      if (!saved.externalId) continue;
      const key = `${saved.source}:${saved.externalId}`;
      const arr = map.get(key) ?? [];
      arr.push(saved);
      map.set(key, arr);
    }
    return map;
  }, [savedSongsQuery.data]);

  const getMatches = useMemo(
    () => (source: string, externalId: string | null) =>
      externalId ? (matchesByKey.get(`${source}:${externalId}`) ?? []) : [],
    [matchesByKey],
  );

  return {
    isLoading: !isPublicAccess && savedSongsQuery.isLoading,
    getMatches,
  };
};
