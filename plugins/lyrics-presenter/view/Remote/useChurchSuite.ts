import { usePluginAPI } from "../pluginApi";
import { trpc } from "../trpc";

/** Owns the ChurchSuite connection, made from an API user's client credentials */
export const useChurchSuite = () => {
  const pluginApi = usePluginAPI();
  const pluginId = pluginApi.pluginContext.pluginId;
  const isPublicAccess = pluginApi.isPublicAccess;

  const statusQuery = trpc.lyricsPresenter.churchSuite.status.useQuery(
    { pluginId },
    { enabled: !isPublicAccess },
  );
  const refetchStatus = statusQuery.refetch;

  const connectMutation = trpc.lyricsPresenter.churchSuite.connect.useMutation({
    onSuccess: () => void refetchStatus(),
  });

  const disconnectMutation =
    trpc.lyricsPresenter.churchSuite.disconnect.useMutation({
      onSuccess: () => void refetchStatus(),
      onError: (err) =>
        pluginApi.remote.toast.error(
          err.message || "Could not disconnect ChurchSuite",
        ),
    });

  return {
    isLoading: statusQuery.isLoading,
    connection: statusQuery.data?.connection ?? null,
    connect: (credentials: { clientId: string; clientSecret: string }) =>
      connectMutation.mutateAsync({ pluginId, ...credentials }),
    isConnecting: connectMutation.isPending,
    connectError: connectMutation.error?.message ?? null,
    disconnect: () => disconnectMutation.mutate({ pluginId }),
    isDisconnecting: disconnectMutation.isPending,
  };
};
