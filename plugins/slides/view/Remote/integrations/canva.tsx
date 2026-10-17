import { useCallback, useEffect, useRef, useState } from "react";

import { CanvaIconLogo } from "../../components/CanvaLogo";
import { canvaBrand } from "../../components/integrationBranding";
import { usePluginAPI } from "../../pluginApi";
import { trpc } from "../../trpc";
import {
  CanvaDesignPicker,
  CanvaSource,
} from "../ImportFile/CanvaDesignPicker";
import { IntegrationAccountChooser } from "./IntegrationAccountChooser";
import { claimExternalWindow, openExternally } from "./externalWindow";
import {
  IntegrationControllerProps,
  IntegrationLaunchContext,
  SlideIntegration,
} from "./types";

const log = (...args: unknown[]) => console.log("[canva]", ...args);

/** How long to wait for the sign-in popup before giving up. */
const CONNECT_TIMEOUT_MS = 3 * 60 * 1000;

const SIGN_IN_POLL_MS = 2000;
// Matches the intent's lifetime on the cloud
const SIGN_IN_TIMEOUT_MS = 15 * 60 * 1000;

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
  // Studio: a sign-in running in the system browser on the cloud
  const [cloudSignIn, setCloudSignIn] = useState<{
    intentId: string;
    mode: "connect" | "once";
    startedAt: number;
  } | null>(null);
  const [source, setSource] = useState<CanvaSource | null>(null);
  const launchContextRef = useRef<IntegrationLaunchContext>({});
  // Polling can report the same result twice; act on it once
  const handledIntentRef = useRef<string | null>(null);

  const statusQuery = trpc.slides.canvaStatus.useQuery({ pluginId });
  const selectDesignMutation = trpc.slides.selectCanvaDesign.useMutation();
  const disconnectMutation = trpc.slides.canvaDisconnect.useMutation();
  const beginSignInMutation = trpc.slides.canvaBeginSignIn.useMutation();
  const signInStatusQuery = trpc.slides.canvaSignInStatus.useQuery(
    { pluginId, intentId: cloudSignIn?.intentId ?? "" },
    {
      enabled: !!cloudSignIn,
      refetchInterval: SIGN_IN_POLL_MS,
      retry: false,
    },
  );

  const refetchStatus = statusQuery.refetch;

  const status = statusQuery.data;
  const connections =
    status && "connections" in status ? status.connections : [];

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
      const linked =
        res.data && "connections" in res.data ? res.data.connections : [];
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

  // Studio: the sign-in finishes on the cloud, and its intent says how
  useEffect(() => {
    if (!cloudSignIn) return;

    if (signInStatusQuery.error) {
      setCloudSignIn(null);
      pluginApi.remote.toast.error(signInStatusQuery.error.message);
      return;
    }

    const data = signInStatusQuery.data;
    if (data?.status === "done" && data.result) {
      setCloudSignIn(null);
      if (handledIntentRef.current === cloudSignIn.intentId) return;
      handledIntentRef.current = cloudSignIn.intentId;
      if ("grantId" in data.result) {
        openPicker({ grantId: data.result.grantId });
      } else {
        void refetchStatus().then(() => setIsChooserOpen(true));
      }
      return;
    }
    if (data?.status === "failed") {
      setCloudSignIn(null);
      pluginApi.remote.toast.error(data.error ?? "Canva sign-in failed.");
      return;
    }
    if (Date.now() - cloudSignIn.startedAt > SIGN_IN_TIMEOUT_MS) {
      setCloudSignIn(null);
    }
  }, [
    cloudSignIn,
    signInStatusQuery.data,
    signInStatusQuery.error,
    openPicker,
    refetchStatus,
    pluginApi,
  ]);

  /** Studio: signs in on the cloud, in the system browser. */
  const startCloudSignIn = useCallback(
    async (mode: "connect" | "once") => {
      setIsChooserOpen(false);
      const claimed = claimExternalWindow();
      try {
        const { intentId, url } = await beginSignInMutation.mutateAsync({
          pluginId,
          mode,
        });
        await openExternally(claimed, url);
        setCloudSignIn({ intentId, mode, startedAt: Date.now() });
        pluginApi.remote.toast.info(
          "Finish signing in to Canva in the browser window that opened.",
        );
      } catch (err: any) {
        claimed?.close();
        pluginApi.remote.toast.error(
          err?.message ?? "Could not start the Canva sign-in.",
        );
      }
    },
    [beginSignInMutation, pluginId, pluginApi],
  );

  const startConnect = useCallback(
    (mode: "connect" | "once") => {
      if (status?.mode === "remote") {
        void startCloudSignIn(mode);
        return;
      }
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
    [
      pluginApi.pluginContext.organizationId,
      connections,
      status,
      startCloudSignIn,
    ],
  );

  const handleOpen = useCallback(
    (context?: IntegrationLaunchContext) => {
      if (statusQuery.error) {
        pluginApi.remote.toast.error(statusQuery.error.message);
        return;
      }
      if (status?.mode === "unavailable") {
        pluginApi.remote.toast.error(status.reason);
        return;
      }
      launchContextRef.current = context ?? {};
      setIsChooserOpen(true);
    },
    [status, statusQuery.error, pluginApi],
  );

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

  const activeConnectionId =
    source && "connectionId" in source ? source.connectionId : null;

  return (
    <>
      {children({
        // Not while a Studio sign-in waits on the browser: if that tab was
        // closed, clicking again starts over rather than waiting it out
        isLoading:
          !!connecting ||
          beginSignInMutation.isPending ||
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
