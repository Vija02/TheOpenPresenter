import { useCallback, useEffect, useRef, useState } from "react";
import { SiCanva } from "react-icons/si";

import { usePluginAPI } from "../../pluginApi";
import { trpc } from "../../trpc";
import { CanvaAccountChooser } from "../ImportFile/CanvaAccountChooser";
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

  const [isChooserOpen, setIsChooserOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(
    null,
  );
  const launchContextRef = useRef<IntegrationLaunchContext>({});

  const statusQuery = trpc.slides.canvaStatus.useQuery({ pluginId });
  const selectDesignMutation = trpc.slides.selectCanvaDesign.useMutation();

  const refetchStatus = statusQuery.refetch;

  const connections = statusQuery.data?.connections ?? [];

  const finishConnect = useCallback(async () => {
    const res = await refetchStatus();
    const linked = res.data?.connections ?? [];
    if (linked.length === 0) return false;
    log("connected", { count: linked.length });
    setIsConnecting(false);
    setIsChooserOpen(true);
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
      if (connections.length === 0) {
        startConnect();
      } else {
        setIsChooserOpen(true);
      }
    },
    [connections.length, startConnect],
  );

  const handleChooseAccount = useCallback((connectionId: string) => {
    setActiveConnectionId(connectionId);
    setIsChooserOpen(false);
    setIsPickerOpen(true);
  }, []);

  const handleSwitchAccount = useCallback(() => {
    setIsPickerOpen(false);
    setIsChooserOpen(true);
  }, []);

  const handleSelected = useCallback(
    ({ designId, title }: { designId: string; title: string }) => {
      if (!activeConnectionId) return;
      selectDesignMutation.mutate({
        pluginId,
        connectionId: activeConnectionId,
        designId,
        name: title,
        replaceImportId: launchContextRef.current.replaceImportId,
      });
      launchContextRef.current.onComplete?.();
    },
    [selectDesignMutation, pluginId, activeConnectionId],
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

      <CanvaAccountChooser
        isOpen={isChooserOpen}
        onClose={() => setIsChooserOpen(false)}
        connections={connections}
        onChoose={handleChooseAccount}
        onAddAccount={() => {
          setIsChooserOpen(false);
          startConnect();
        }}
        onChanged={() => {
          void refetchStatus().then((res) => {
            if ((res.data?.connections ?? []).length === 0) {
              setIsChooserOpen(false);
            }
          });
        }}
      />

      <CanvaDesignPicker
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelected={handleSelected}
        connectionId={activeConnectionId}
        accountLabel={
          connections.find((c) => c.id === activeConnectionId)?.label ?? null
        }
        onSwitchAccount={
          connections.length > 1 ? handleSwitchAccount : undefined
        }
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
