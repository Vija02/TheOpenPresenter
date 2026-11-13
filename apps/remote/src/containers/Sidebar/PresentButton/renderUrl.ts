import { desktop } from "@repo/desktop-bridge";
import { usePluginMetaData } from "@repo/shared";
import { useCallback, useEffect, useState } from "react";
import { useSearch } from "wouter";

/** Keeps the search params: they carry the proxy settings */
export const buildRenderPath = (
  orgSlug: string,
  projectSlug: string,
  search: string,
  outputId: string,
  { preview = false }: { preview?: boolean } = {},
) => {
  const params = new URLSearchParams(search);
  params.set("renderer", outputId);
  if (preview) params.set("preview", "1");
  return `/render/${orgSlug}/${projectSlug}?${params.toString()}`;
};

export const useRenderUrl = () => {
  const { orgSlug, projectSlug } = usePluginMetaData();
  const search = useSearch();
  return useCallback(
    (outputId: string, options?: { preview?: boolean }) =>
      buildRenderPath(orgSlug, projectSlug, search, outputId, options),
    [orgSlug, projectSlug, search],
  );
};

/** Studio's localhost swapped for its network address */
export const useShareOrigin = () => {
  const [localIp, setLocalIp] = useState<string | null>(null);
  useEffect(() => {
    if (desktop.isDesktop) void desktop.localIp().then(setLocalIp);
  }, []);

  const url = new URL(window.location.origin);
  if (
    localIp &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1")
  ) {
    url.hostname = localIp;
  }
  return url.origin;
};

export const useRemoteUrl = () => {
  const { orgSlug, projectSlug } = usePluginMetaData();
  const search = useSearch();
  const origin = useShareOrigin();
  const path = `/app/${orgSlug}/${projectSlug}`;
  return `${origin}${search ? `${path}?${search}` : path}`;
};
