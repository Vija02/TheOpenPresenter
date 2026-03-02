import {
  RemoteBasePluginQuery,
  RendererBasePluginQuery,
  useRemoteBasePluginQuery,
  useRendererBasePluginQuery,
} from "@repo/graphql";
import { ErrorAlert, LoadingFull } from "@repo/ui";
import React, { createContext, useContext, useMemo } from "react";

type Project = NonNullable<
  | NonNullable<
      RendererBasePluginQuery["organizationBySlug"]
    >["projects"]["nodes"][number]
  | NonNullable<RendererBasePluginQuery["publicProject"]>["nodes"][number]
>;

type PluginMeta =
  | RendererBasePluginQuery["pluginMeta"]
  | RemoteBasePluginQuery["pluginMeta"];

type PluginMetaDataProviderType = {
  pluginMeta: PluginMeta | null;
  project: Project | null;
  orgId: string;
  orgSlug: string;
  projectSlug: string;
  projectId: string;
  refetch: () => void;
};

const initialData: PluginMetaDataProviderType = {
  pluginMeta: null,
  project: null,
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

  const project = useMemo(() => {
    if (
      pluginMetaData?.organizationBySlug?.projects.nodes &&
      pluginMetaData?.organizationBySlug?.projects.nodes.length > 0
    ) {
      return pluginMetaData?.organizationBySlug?.projects.nodes[0];
    }
    if (
      pluginMetaData?.publicProject?.nodes &&
      pluginMetaData?.publicProject?.nodes.length > 0
    ) {
      return pluginMetaData?.publicProject?.nodes[0];
    }
    return null;
  }, [
    pluginMetaData?.organizationBySlug?.projects.nodes,
    pluginMetaData?.publicProject?.nodes,
  ]);

  const projectId = project?.id ?? null;

  const organizationId = useMemo(() => {
    if (
      pluginMetaData?.organizationBySlug?.projects.nodes &&
      pluginMetaData?.organizationBySlug?.projects.nodes.length > 0
    ) {
      return pluginMetaData?.organizationBySlug?.id;
    }
    if (
      pluginMetaData?.publicProject?.nodes &&
      pluginMetaData?.publicProject?.nodes.length > 0
    ) {
      return pluginMetaData?.publicProject.nodes[0].organizationId;
    }
    return null;
  }, [
    pluginMetaData?.organizationBySlug?.id,
    pluginMetaData?.organizationBySlug?.projects.nodes,
    pluginMetaData?.publicProject?.nodes,
  ]);

  if (error) {
    console.error(error);
    return <ErrorAlert error={error} />;
  }

  if (loading && !pluginMetaData) {
    return <LoadingFull />;
  }

  // Handle project doesn't exist
  if (!projectId) {
    window.location.href = `/o/${orgSlug}`;
    return <p>Project does not exist. Redirecting...</p>;
  }

  return (
    <PluginMetaDataContext.Provider
      value={{
        pluginMeta: pluginMetaData?.pluginMeta ?? null,
        project,
        orgId: organizationId,
        orgSlug,
        projectSlug,
        projectId: projectId,
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
