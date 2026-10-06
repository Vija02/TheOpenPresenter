import { useCallback, useEffect, useRef, useState } from "react";

import { CanvaIconLogo } from "../../components/CanvaLogo";
import { canvaBrand } from "../../components/integrationBranding";
import { usePluginAPI } from "../../pluginApi";
import { trpc } from "../../trpc";
import { CanvaDesignPicker, CanvaSource } from "../ImportFile/CanvaDesignPicker";
import { IntegrationAccountChooser } from "./IntegrationAccountChooser";
import {
  IntegrationControllerProps,
  IntegrationLaunchContext,
  SlideIntegration,
} from "./types";

const log = (...args: unknown[]) => console.log("[canva]", ...args);

/** How long to wait for the sign-in popup before giving up. */
const CONNECT_TIMEOUT_MS = 3 * 60 * 1000;

const CanvaController = ({ children }: IntegrationControllerProps) => {
  const pluginApi = usePluginAPI();
  const pluginId = pluginApi.pluginContext.pluginId;

  const [isChooserOpen, setIsChooserOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  // The sign-in popup this controller opened, if any. An import-once sign-in
  // leaves no connection, so it can only report back by message. A connect
  // remembers the accounts already there, so polling can spot the new one.
  const [connecting, setConnecting] = useState<
    { mode: "once" } | { mode: "connect"; knownIds: string[] } | null
  >(null);
  const [source, setSource] = useState<CanvaSource | null>(null);
  const launchContextRef = useRef<IntegrationLaunchContext>({});

  const statusQuery = trpc.slides.canvaStatus.useQuery({ pluginId });
  const selectDesignMutation = trpc.slides.selectCanvaDesign.useMutation();
  const disconnectMutation = trpc.slides.canvaDisconnect.useMutation();

  const refetchStatus = statusQuery.refetch;

  const connections = statusQuery.data?.connections ?? [];

  const openPicker = useCallback((next: CanvaSource) => {
    setSource(next);
    setIsChooserOpen(false);
    setIsPickerOpen(true);
  }, []);

  // Only the controller that opened the popup listens: the add-slides picker
  // keeps more than one mounted, and each would otherwise react
  useEffect(() => {
    if (!connecting) return;

    let isDone = false;
    const done = () => {
      isDone = true;
      setConnecting(null);
    };

    /** A connect finished: back to the chooser, now listing the account. */
    const finishConnect = async ({ isConfirmed }: { isConfirmed: boolean }) => {
      const res = await refetchStatus();
      if (isDone || connecting.mode !== "connect") return;
      const linked = res.data?.connections ?? [];
      const isNew = linked.some((c) => !connecting.knownIds.includes(c.id));
      // Reconnecting a known account adds nothing new, so only the popup's
      // own message can confirm that
      if (!isNew && !(isConfirmed && linked.length > 0)) return;
      log("connected", { count: linked.length });
      done();
      setIsChooserOpen(true);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        log("ignored message from foreign origin", event.origin);
        return;
      }
      if (event.data?.source !== "top-canva-oauth" || isDone) return;

      if (!event.data.ok) {
        done();
        pluginApi.remote.toast.error(
          event.data.error ?? "Canva sign-in failed.",
        );
        return;
      }
      if (connecting.mode === "once") {
        if (typeof event.data.grantId !== "string") return;
        done();
        openPicker({ grantId: event.data.grantId });
        return;
      }
      void finishConnect({ isConfirmed: true });
    };
    window.addEventListener("message", onMessage);

    // Fallback for when postMessage never arrives. Only a connection can be
    // found this way; an import-once sign-in just times out.
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - startedAt > CONNECT_TIMEOUT_MS) {
        log("connect timed out waiting for popup");
        done();
        return;
      }
      void finishConnect({ isConfirmed: false });
    }, 1500);

    return () => {
      isDone = true;
      window.removeEventListener("message", onMessage);
      clearInterval(timer);
    };
  }, [connecting, refetchStatus, openPicker, pluginApi]);

  const startConnect = useCallback(
    (mode: "connect" | "once") => {
      const organizationId = pluginApi.pluginContext.organizationId;
      const url = `/plugin/slides/canva/authorize?organizationId=${encodeURIComponent(
        organizationId,
      )}${mode === "once" ? "&once=1" : ""}`;
      log("startConnect -> opening popup", { organizationId, mode });
      setIsChooserOpen(false);
      setConnecting(
        mode === "once"
          ? { mode }
          : { mode, knownIds: connections.map((c) => c.id) },
      );
      const popup = window.open(url, "canva-oauth", "width=600,height=800");
      if (!popup || popup.closed) {
        log("POPUP BLOCKED by the browser");
      }
    },
    [pluginApi.pluginContext.organizationId, connections],
  );

  const handleOpen = useCallback((context?: IntegrationLaunchContext) => {
    launchContextRef.current = context ?? {};
    setIsChooserOpen(true);
  }, []);

  const handleSwitchAccount = useCallback(() => {
    setIsPickerOpen(false);
    setIsChooserOpen(true);
  }, []);

  const handleSelected = useCallback(
    ({ designId, title }: { designId: string; title: string }) => {
      if (!source) return;
      selectDesignMutation.mutate(
        {
          pluginId,
          ...source,
          designId,
          name: title,
          replaceImportId: launchContextRef.current.replaceImportId,
        },
        { onError: (err) => pluginApi.remote.toast.error(err.message) },
      );
      launchContextRef.current.onComplete?.();
    },
    [selectDesignMutation, pluginId, pluginApi, source],
  );

  if (statusQuery.data && !statusQuery.data.configured) {
    return null;
  }

  const activeConnectionId =
    source && "connectionId" in source ? source.connectionId : null;

  return (
    <>
      {children({
        isLoading:
          !!connecting ||
          statusQuery.isLoading ||
          selectDesignMutation.isPending,
        open: handleOpen,
      })}

      <IntegrationAccountChooser
        isOpen={isChooserOpen}
        onClose={() => setIsChooserOpen(false)}
        name="Canva"
        icon={(className) => <CanvaIconLogo className={className} />}
        accounts={connections.map((connection) => ({
          id: connection.id,
          label: connection.label,
          sublabel: connection.connectedByName
            ? `Added by ${connection.connectedByName}`
            : null,
        }))}
        onChoose={(connectionId) => openPicker({ connectionId })}
        connect={{
          description:
            "Stays connected for everyone in this organization, so anyone can pick from it.",
          onClick: () => startConnect("connect"),
        }}
        onImportOnce={() => startConnect("once")}
        disconnect={{
          description:
            "Everyone in this organization will lose access to its designs until it is connected again. Slides you have already imported are unaffected.",
          onConfirm: async (connectionId) => {
            try {
              await disconnectMutation.mutateAsync({ pluginId, connectionId });
            } catch (err: any) {
              pluginApi.remote.toast.error(
                err?.message ?? "Could not disconnect the Canva account.",
              );
            }
            await refetchStatus();
          },
        }}
      />

      <CanvaDesignPicker
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelected={handleSelected}
        source={source}
        accountLabel={
          activeConnectionId
            ? (connections.find((c) => c.id === activeConnectionId)?.label ??
              null)
            : "Signed in for this import only"
        }
        onSwitchAccount={handleSwitchAccount}
      />
    </>
  );
};

export const canvaIntegration: SlideIntegration = {
  ...canvaBrand,
  Controller: CanvaController,
};
