import {
  OrganizationType,
  RemoteBasePluginQuery,
  RendererBasePluginQuery,
  useRemoteBasePluginQuery,
  useRendererBasePluginQuery,
} from "@repo/graphql";
import { preloader } from "@repo/lib";
import {
  identifyUser,
  resetAnalytics,
} from "@repo/observability/initAnalytics";
import { ErrorAlert, LoadingFull } from "@repo/ui";
import React, { createContext, useContext, useEffect, useMemo } from "react";

type Project = NonNullable<
  | NonNullable<
      RendererBasePluginQuery["organizationBySlug"]
    >["projects"]["nodes"][number]
  | NonNullable<
      RendererBasePluginQuery["publicOrGuestProject"]
    >["nodes"][number]
>;

type PluginMeta =
  | RendererBasePluginQuery["pluginMeta"]
  | RemoteBasePluginQuery["pluginMeta"];

export type ScreenGuestSession = NonNullable<
  RemoteBasePluginQuery["currentScreenGuestSession"]
>;

export type CurrentUser = NonNullable<RemoteBasePluginQuery["currentUser"]>;

type PluginMetaDataProviderType = {
  pluginMeta: PluginMeta | null;
  project: Project | null;
  orgId: string;
  orgSlug: string;
  organizationType: OrganizationType | null;
  experimentalFeaturesEnabled: boolean;
  projectSlug: string;
  projectId: string;
  currentUser: CurrentUser | null;
  screenGuestSession: ScreenGuestSession | null;
  isPublicAccess: boolean;
  refetch: () => void;
};

const initialData: PluginMetaDataProviderType = {
  pluginMeta: null,
  project: null,
  orgId: "",
  orgSlug: "",
  organizationType: null,
  experimentalFeaturesEnabled: false,
  projectSlug: "",
  projectId: "",
  currentUser: null,
  screenGuestSession: null,
  isPublicAccess: false,
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
      pluginMetaData?.publicOrGuestProject?.nodes &&
      pluginMetaData?.publicOrGuestProject?.nodes.length > 0
    ) {
      return pluginMetaData?.publicOrGuestProject?.nodes[0];
    }
    return null;
  }, [
    pluginMetaData?.organizationBySlug?.projects.nodes,
    pluginMetaData?.publicOrGuestProject?.nodes,
  ]);

  const projectId = project?.id ?? null;

  const currentUser: CurrentUser | null = pluginMetaData?.currentUser ?? null;

  const screenGuestSession: ScreenGuestSession | null =
    pluginMetaData && "currentScreenGuestSession" in pluginMetaData
      ? (pluginMetaData.currentScreenGuestSession ?? null)
      : null;

  const isPublicAccess =
    !currentUser && !screenGuestSession && !!project?.isPublic;

  const organizationId = useMemo(() => {
    if (
      pluginMetaData?.organizationBySlug?.projects.nodes &&
      pluginMetaData?.organizationBySlug?.projects.nodes.length > 0
    ) {
      return pluginMetaData?.organizationBySlug?.id;
    }
    if (
      pluginMetaData?.publicOrGuestProject?.nodes &&
      pluginMetaData?.publicOrGuestProject?.nodes.length > 0
    ) {
      return pluginMetaData?.publicOrGuestProject.nodes[0].organizationId;
    }
    return null;
  }, [
    pluginMetaData?.organizationBySlug?.id,
    pluginMetaData?.organizationBySlug?.projects.nodes,
    pluginMetaData?.publicOrGuestProject?.nodes,
  ]);

  const currentUserId = currentUser?.id;

  useEffect(() => {
    if (!currentUserId) {
      if (pluginMetaData && !loading) {
        resetAnalytics();
      }
      return;
    }

    identifyUser({
      userId: currentUserId,
      organizationId,
      organizationSlug: orgSlug,
    });
  }, [currentUserId, organizationId, orgSlug, pluginMetaData, loading]);

  // Register client plugin files. Not in useEffect due to loading behaviour
  const clientPluginViews: any[] =
    pluginMetaData?.pluginMeta &&
    "clientPluginViews" in pluginMetaData.pluginMeta
      ? ((pluginMetaData.pluginMeta as any).clientPluginViews ?? [])
      : [];
  for (const view of clientPluginViews) {
    preloader.registerRuntimePlugin(view.pluginName, {
      scripts:
        type === "remote"
          ? (view.remoteScripts ?? [])
          : (view.rendererScripts ?? []),
      css:
        type === "remote" ? (view.remoteCss ?? []) : (view.rendererCss ?? []),
    });
  }

  // Allow overriding the organization type
  const organizationTypeOverride = useMemo<OrganizationType | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = new URLSearchParams(window.location.search).get(
      "organizationType",
    );
    if (!raw) return null;
    const match = Object.values(OrganizationType).find(
      (value) => value.toLowerCase() === raw.toLowerCase(),
    );
    return (match as OrganizationType | undefined) ?? null;
  }, []);

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
        organizationType:
          organizationTypeOverride ??
          pluginMetaData?.organizationBySlug?.organizationType ??
          null,
        experimentalFeaturesEnabled:
          pluginMetaData?.organizationBySlug?.experimentalFeaturesEnabled ??
          false,
        projectSlug,
        projectId: projectId,
        currentUser,
        screenGuestSession,
        isPublicAccess,
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
