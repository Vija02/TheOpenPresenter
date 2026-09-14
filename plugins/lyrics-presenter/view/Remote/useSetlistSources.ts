import { useCallback, useMemo } from "react";

import { usePluginAPI } from "../pluginApi";
import { trpc } from "../trpc";
import { Setlist } from "./RemoteAddSongModal/MainView/setlistTypes";
import { usePlanningCenter } from "./usePlanningCenter";

/**
 * Which setlist sources this organization has switched on.
 */
export const useSetlistSources = () => {
  const pluginApi = usePluginAPI();
  const pluginId = pluginApi.pluginContext.pluginId;
  const isPublicAccess = pluginApi.isPublicAccess;

  const planningCenter = usePlanningCenter();

  const sourcesQuery = trpc.lyricsPresenter.setlistSources.list.useQuery(
    { pluginId },
    { enabled: !isPublicAccess },
  );
  const refetchSources = sourcesQuery.refetch;

  const setEnabledMutation =
    trpc.lyricsPresenter.setlistSources.setEnabled.useMutation({
      onSuccess: () => void refetchSources(),
      onError: () =>
        pluginApi.remote.toast.error("Could not update setlist sources"),
    });

  const isMyWorshipListEnabled =
    sourcesQuery.data?.enabled.includes("myworshiplist") ?? false;

  const setMyWorshipListEnabled = useCallback(
    (enabled: boolean) =>
      setEnabledMutation.mutate({
        pluginId,
        source: "myworshiplist",
        enabled,
      }),
    [pluginId, setEnabledMutation],
  );

  const sources = useMemo(() => {
    const enabled: Setlist["source"][] = [];
    if (planningCenter.connections.length > 0) enabled.push("planningCenter");
    if (isMyWorshipListEnabled) enabled.push("myworshiplist");
    return enabled;
  }, [isMyWorshipListEnabled, planningCenter.connections.length]);

  return {
    sources,
    isLoading: sourcesQuery.isLoading || planningCenter.isLoading,
    isMyWorshipListEnabled,
    setMyWorshipListEnabled,
    isSaving: setEnabledMutation.isPending,
    planningCenter,
  };
};
