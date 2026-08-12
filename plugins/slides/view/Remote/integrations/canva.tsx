import { useCallback, useEffect, useRef, useState } from "react";
import { SiCanva } from "react-icons/si";

import { usePluginAPI } from "../../pluginApi";
import { trpc } from "../../trpc";
import { CanvaDesignPicker } from "../ImportFile/CanvaDesignPicker";
import {
  IntegrationControllerProps,
  IntegrationLaunchContext,
  SlideIntegration,
} from "./types";

const log = (...args: unknown[]) => console.log("[canva]", ...args);

const CanvaController = ({ children }: IntegrationControllerProps) => {
  const pluginApi = usePluginAPI();
  const pluginId = pluginApi.pluginContext.pluginId;

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const launchContextRef = useRef<IntegrationLaunchContext>({});

  const statusQuery = trpc.slides.canvaStatus.useQuery({ pluginId });
  const selectDesignMutation = trpc.slides.selectCanvaDesign.useMutation();

  const refetchStatus = statusQuery.refetch;

  const finishConnect = useCallback(async () => {
    const res = await refetchStatus();
    if (!res.data?.connected) return false;
    log("connected, opening picker");
    setIsConnecting(false);
    setIsPickerOpen(true);
    return true;
  }, [refetchStatus]);

  // Listen for response
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        log("ignored message from foreign origin", event.origin);
        return;
      }
      if (event.data?.source !== "top-canva-oauth") return;

      log("popup reported back", event.data);
      if (event.data.ok) {
        void finishConnect();
      } else {
        setIsConnecting(false);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
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
        log("connect timed out waiting for popup");
        setIsConnecting(false);
        return;
      }
      void finishConnect();
    }, 1500);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isConnecting, finishConnect]);

  const startConnect = useCallback(() => {
    const organizationId = pluginApi.pluginContext.organizationId;
    const url = `/plugin/slides/canva/authorize?organizationId=${encodeURIComponent(
      organizationId,
    )}`;
    log("startConnect -> opening popup", { organizationId, url });
    setIsConnecting(true);
    const popup = window.open(url, "canva-oauth", "width=600,height=800");
    if (!popup || popup.closed) {
      log("POPUP BLOCKED by the browser");
    } else {
      log("popup opened");
    }
  }, [pluginApi.pluginContext.organizationId]);

  const handleOpen = useCallback(
    (context?: IntegrationLaunchContext) => {
      launchContextRef.current = context ?? {};
      log("card clicked", {
        statusData: statusQuery.data,
        connected: statusQuery.data?.connected,
        branch: statusQuery.data?.connected ? "OPEN_PICKER" : "START_CONNECT",
        context,
      });
      if (statusQuery.data?.connected) {
        setIsPickerOpen(true);
      } else {
        startConnect();
      }
    },
    [statusQuery.data, startConnect],
  );

  const handleSelected = useCallback(
    ({ designId, title }: { designId: string; title: string }) => {
      log("design selected", { designId, title });
      selectDesignMutation.mutate({
        pluginId,
        designId,
        name: title,
        replaceImportId: launchContextRef.current.replaceImportId,
      });
      launchContextRef.current.onComplete?.();
    },
    [selectDesignMutation, pluginId],
  );

  if (statusQuery.data && !statusQuery.data.configured) {
    return null;
  }

  return (
    <>
      {children({
        isLoading:
          isConnecting ||
          statusQuery.isLoading ||
          selectDesignMutation.isPending,
        open: handleOpen,
      })}

      <CanvaDesignPicker
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelected={handleSelected}
        connectedByName={statusQuery.data?.connectedByName}
        onDisconnected={() => {
          log("disconnected, refetching status");
          void refetchStatus();
        }}
      />
    </>
  );
};

export const canvaIntegration: SlideIntegration = {
  id: "canva",
  name: "Canva",
  icon: <SiCanva className="size-10 text-[#00C4CC]" />,
  Controller: CanvaController,
};
