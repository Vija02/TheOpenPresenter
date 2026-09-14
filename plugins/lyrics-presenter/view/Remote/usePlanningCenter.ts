import { useCallback, useEffect, useState } from "react";

import { usePluginAPI } from "../pluginApi";
import { trpc } from "../trpc";

/** Owns the Planning Center connection state and the OAuth popup round trip */
export const usePlanningCenter = () => {
  const pluginApi = usePluginAPI();
  const pluginId = pluginApi.pluginContext.pluginId;
  const organizationId = pluginApi.pluginContext.organizationId;
  const isPublicAccess = pluginApi.isPublicAccess;

  const [isConnecting, setIsConnecting] = useState(false);
  // Why the last connect attempt failed, shown next to the connect button.
  const [connectError, setConnectError] = useState<string | null>(null);

  const statusQuery = trpc.lyricsPresenter.planningCenter.status.useQuery(
    { pluginId },
    { enabled: !isPublicAccess },
  );
  const refetchStatus = statusQuery.refetch;

  const connections = statusQuery.data?.connections ?? [];
  const isConfigured = statusQuery.data?.configured ?? false;

  const finishConnect = useCallback(async () => {
    const res = await refetchStatus();
    if ((res.data?.connections ?? []).length === 0) return false;
    setIsConnecting(false);
    return true;
  }, [refetchStatus]);

  const startConnect = useCallback(() => {
    setIsConnecting(true);
    setConnectError(null);
    window.open(
      `/plugin/lyrics-presenter/pco/authorize?organizationId=${encodeURIComponent(
        organizationId,
      )}`,
      "pco-oauth",
      "width=600,height=800",
    );
  }, [organizationId]);

  useEffect(() => {
    const handleResult = (data: any) => {
      if (data?.source !== "top-pco-oauth") return;

      if (data.ok) {
        void finishConnect();
      } else {
        setIsConnecting(false);
        setConnectError(
          typeof data.error === "string" && data.error
            ? data.error
            : "Could not connect to Planning Center. Please try again.",
        );
      }
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      handleResult(event.data);
    };

    const channel = new BroadcastChannel("top-pco-oauth");
    channel.onmessage = (event) => handleResult(event.data);

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      channel.close();
    };
  }, [finishConnect]);

  // Fallback for when postMessage never arrives
  useEffect(() => {
    if (!isConnecting) return;

    let cancelled = false;
    const startedAt = Date.now();
    const TIMEOUT_MS = 3 * 60 * 1000;

    const timer = setInterval(() => {
      if (cancelled) return;
      if (Date.now() - startedAt > TIMEOUT_MS) {
        setIsConnecting(false);
        setConnectError(
          "The Planning Center window timed out. Please try again.",
        );
        return;
      }
      void finishConnect();
    }, 1500);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isConnecting, finishConnect]);

  return {
    isConfigured,
    isLoading: statusQuery.isLoading,
    connections,
    isConnecting,
    connectError,
    startConnect,
    refetchStatus,
  };
};
