import {
  RemoteBasePluginQuery,
  RendererBasePluginQuery,
  useRemoteBasePluginQuery,
  useRendererBasePluginQuery,
} from "@repo/graphql";
import { ErrorOccurred, LoadingFull } from "@repo/ui";
import React, { createContext, useContext, useMemo } from "react";

type PluginMetaDataProviderType = {
  pluginMetaData: RendererBasePluginQuery | RemoteBasePluginQuery | null;
  orgId: string;
  orgSlug: string;
  projectSlug: string;
  projectId: string;
  refetch: () => void;
};

const initialData: PluginMetaDataProviderType = {
  pluginMetaData: null,
  orgId: "",
  orgSlug: "",
  projectSlug: "",
  projectId: "",
  refetch: () => {},
};

export const PluginMetaDataContext =
  createContext<PluginMetaDataProviderType>(initialData);

export function PluginMetaDataProvider({
  children,
  orgSlug,
  projectSlug,
  type,
}: React.PropsWithChildren<{
  orgSlug: string;
  projectSlug: string;
  type: "remote" | "renderer";
}>) {
  const useFunc =
    type === "remote" ? useRemoteBasePluginQuery : useRendererBasePluginQuery;
  const { data, previousData, loading, error, refetch } = useFunc({
    variables: { orgSlug, projectSlug },
  });
  const pluginMetaData = useMemo(
    () => data ?? previousData,
    [data, previousData],
  );

  if (error) {
    console.error(error);
    return <ErrorOccurred />;
  }

  if (loading && !pluginMetaData) {
    return <LoadingFull />;
  }

  // Check that project doesn't exist
  if (
    !pluginMetaData?.organizationBySlug?.projects.nodes ||
    pluginMetaData.organizationBySlug.projects.nodes.length === 0
  ) {
    window.location.href = `/o/${orgSlug}`;
    return <p>Project does not exist. Redirecting...</p>;
  }

  return (
    <PluginMetaDataContext.Provider
      value={{
        pluginMetaData: pluginMetaData ?? null,
        orgId: pluginMetaData.organizationBySlug.id,
        orgSlug,
        projectSlug,
        projectId: pluginMetaData?.organizationBySlug?.projects.nodes[0]?.id,
        refetch,
      }}
    >
      {!!pluginMetaData && children}
    </PluginMetaDataContext.Provider>
  );
}

export function usePluginMetaData() {
  return useContext(PluginMetaDataContext);
}
