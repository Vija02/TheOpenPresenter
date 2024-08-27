import { Text } from "@chakra-ui/react";
import {
  RendererBasePluginQuery,
  useRendererBasePluginQuery,
} from "@repo/graphql";
import { ErrorOccurred, LoadingFull } from "@repo/ui";
import React, { createContext, useContext } from "react";

type PluginMetaDataProviderType = {
  pluginMetaData: RendererBasePluginQuery | null;
  orgSlug: string;
  projectSlug: string;
  projectId: string;
};

const initialData: PluginMetaDataProviderType = {
  pluginMetaData: null,
  orgSlug: "",
  projectSlug: "",
  projectId: "",
};

export const PluginMetaDataContext =
  createContext<PluginMetaDataProviderType>(initialData);

export function PluginMetaDataProvider({
  children,
  orgSlug,
  projectSlug,
}: React.PropsWithChildren<{ orgSlug: string; projectSlug: string }>) {
  const {
    data: pluginMetaData,
    loading,
    error,
  } = useRendererBasePluginQuery({
    variables: { orgSlug, projectSlug },
  });

  if (error) {
    console.error(error);
    return <ErrorOccurred />;
  }

  if (loading) {
    return <LoadingFull />;
  }

  // Check that project doesn't exist
  if (
    !pluginMetaData?.organizationBySlug?.projects.nodes ||
    pluginMetaData.organizationBySlug.projects.nodes.length === 0
  ) {
    window.location.href = `/o/${orgSlug}`;
    return <Text>Project does not exist. Redirecting...</Text>;
  }

  return (
    <PluginMetaDataContext.Provider
      value={{
        pluginMetaData: pluginMetaData ?? null,
        orgSlug,
        projectSlug,
        projectId: pluginMetaData?.organizationBySlug?.projects.nodes[0]?.id,
      }}
    >
      {!!pluginMetaData && children}
    </PluginMetaDataContext.Provider>
  );
}

export function usePluginMetaData() {
  return useContext(PluginMetaDataContext);
}
