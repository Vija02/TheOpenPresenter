import {
  RemoteBasePluginQuery,
  RendererBasePluginQuery,
  useRemoteBasePluginQuery,
  useRendererBasePluginQuery,
} from "@repo/graphql";
import { ErrorAlert, LoadingFull } from "@repo/ui";
import React, { createContext, useContext } from "react";

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
  const [{ data: pluginMetaData, fetching: loading, error }, refetch] = useFunc(
    {
      variables: { orgSlug, projectSlug },
    },
  );

  if (error) {
    console.error(error);
    return <ErrorAlert error={error} />;
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
