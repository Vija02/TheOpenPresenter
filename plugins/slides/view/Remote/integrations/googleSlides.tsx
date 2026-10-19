import { useCallback, useEffect, useRef, useState } from "react";
import { FcGoogle } from "react-icons/fc";

import { googleSlidesBrand } from "../../components/integrationBranding";
import { usePluginAPI } from "../../pluginApi";
import { listenToPopup, popupOpenedAt } from "../../popupMessages";
import { trpc } from "../../trpc";
import { SlidePicker } from "../ImportFile/SlidePicker";
import { IntegrationAccountChooser } from "./IntegrationAccountChooser";
import { claimExternalWindow, openExternally } from "./externalWindow";
import {
  IntegrationControllerProps,
  IntegrationLaunchContext,
  SlideIntegration,
} from "./types";

const PICK_POLL_MS = 2000;
const PICK_TIMEOUT_MS = 15 * 60 * 1000;

const GOOGLE_CONNECT_DESCRIPTION =
  "Stays connected, so you can pick again without signing in.";
const GOOGLE_DISCONNECT_DESCRIPTION =
  "You will need to connect it again to pick from its Drive. Slides you have already imported are unaffected.";

/** How a pick on the cloud starts. Mirrors RemotePickMode on the server. */
type RemotePickMode = "pick" | "connect" | "once";

const GoogleSlidesController = (props: IntegrationControllerProps) => {
  const pluginApi = usePluginAPI();
  const statusQuery = trpc.slides.googleSlidesStatus.useQuery({
    pluginId: pluginApi.pluginContext.pluginId,
  });
  const status = statusQuery.data;

  if (!status) {
    return props.children({
      isLoading: statusQuery.isLoading,
      open: () => {
        if (statusQuery.error) {
          pluginApi.remote.toast.error(statusQuery.error.message);
        }
      },
    });
  }

  switch (status.mode) {
    case "local":
      return <StoredGoogleSlides {...props} clientId={status.clientId} />;
    case "remote":
      return <RemoteGoogleSlides {...props} />;
    case "unavailable":
      return props.children({
        isLoading: false,
        open: () => pluginApi.remote.toast.error(status.reason),
      });
  }
};

/** The connection is stored on this server; the picker runs in-app. */
const StoredGoogleSlides = ({
  children,
  clientId,
}: IntegrationControllerProps & { clientId: string }) => {
  const pluginApi = usePluginAPI();
  const pluginId = pluginApi.pluginContext.pluginId;

  // Same query as the parent, so this shares its cache
  const statusQuery = trpc.slides.googleSlidesStatus.useQuery({ pluginId });
  const accounts =
    statusQuery.data?.mode === "local" ? statusQuery.data.accounts : [];
  const refetchStatus = statusQuery.refetch;

  const [isChooserOpen, setIsChooserOpen] = useState(false);
  // The most recent account when connecting started. A new or reconnected
  // account moves to the top, which is how polling spots the result.
  const [connectingFrom, setConnectingFrom] = useState<{
    topAccountId: string | null;
    openedAt: number;
  } | null>(null);
  const [token, setToken] = useState<string | null>(null);
  // "stored" opens with an account's token; "once" lets the picker sign in
  // with Google itself, so nothing is stored
  const [openRequest, setOpenRequest] = useState<"stored" | "once" | null>(
    null,
  );
  const openPickerRef = useRef<(() => void) | null>(null);
  const connectionIdRef = useRef<string | null>(null);
  const launchContextRef = useRef<IntegrationLaunchContext>({});

  const tokenMutation = trpc.slides.googleSlidesPickerToken.useMutation();
  const selectMutation = trpc.slides.selectGoogleSlide.useMutation();
  const importOnceMutation = trpc.slides.googleSlidesImportOnce.useMutation();
  const disconnectMutation = trpc.slides.googleSlidesDisconnect.useMutation();

  const openWithAccount = useCallback(
    async (connectionId: string) => {
      try {
        const { accessToken } = await tokenMutation.mutateAsync({
          pluginId,
          connectionId,
        });
        connectionIdRef.current = connectionId;
        setToken(accessToken);
        setOpenRequest("stored");
      } catch (err: any) {
        pluginApi.remote.toast.error(
          err?.message ?? "Could not open Google Drive.",
        );
        void refetchStatus();
      }
    },
    [tokenMutation, pluginId, pluginApi, refetchStatus],
  );

  useEffect(() => {
    if (!openRequest) return;
    if ((openRequest === "stored") !== (token !== null)) return;
    setOpenRequest(null);
    openPickerRef.current?.();
  }, [openRequest, token]);

  const importOnce = useCallback(() => {
    connectionIdRef.current = null;
    setToken(null);
    setOpenRequest("once");
  }, []);

  const startConnect = useCallback(() => {
    const url = `/plugin/slides/google/authorize?organizationId=${encodeURIComponent(
      pluginApi.pluginContext.organizationId,
    )}`;
    setConnectingFrom({
      topAccountId: accounts[0]?.id ?? null,
      openedAt: popupOpenedAt(),
    });
    window.open(url, "google-oauth", "width=500,height=700");
  }, [pluginApi.pluginContext.organizationId, accounts]);

  // The popup reports back once the account is connected; go straight to its
  // Drive
  useEffect(() => {
    if (!connectingFrom) return;

    let isDone = false;
    const finish = async ({ isConfirmed }: { isConfirmed: boolean }) => {
      const res = await refetchStatus();
      const latest = res.data?.mode === "local" ? res.data.accounts[0] : null;
      if (!latest || isDone) return;
      if (!isConfirmed && latest.id === connectingFrom.topAccountId) return;
      isDone = true;
      setConnectingFrom(null);
      void openWithAccount(latest.id);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.source !== "top-google-oauth" || isDone) return;
      if (event.data.ok) {
        void finish({ isConfirmed: true });
      } else {
        isDone = true;
        setConnectingFrom(null);
        pluginApi.remote.toast.error(
          event.data.error ?? "Google connection failed.",
        );
      }
    };
    const stopListening = listenToPopup(connectingFrom.openedAt, onMessage);

    // Fallback for when postMessage never arrives
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - startedAt > 3 * 60 * 1000) {
        setConnectingFrom(null);
        return;
      }
      void finish({ isConfirmed: false });
    }, 1500);

    return () => {
      isDone = true;
      stopListening();
      clearInterval(timer);
    };
  }, [connectingFrom, refetchStatus, openWithAccount, pluginApi]);

  return (
    <>
      <SlidePicker
        clientId={clientId}
        oauthToken={token ?? undefined}
        onFileSelected={(doc, accessToken) => {
          const connectionId = connectionIdRef.current;
          const replaceImportId = launchContextRef.current.replaceImportId;
          const onError = (err: { message: string }) =>
            pluginApi.remote.toast.error(err.message);

          if (connectionId) {
            selectMutation.mutate(
              {
                pluginId,
                connectionId,
                presentationId: doc.id,
                name: doc.name,
                replaceImportId,
              },
              { onError },
            );
          } else {
            importOnceMutation.mutate(
              {
                pluginId,
                token: accessToken,
                presentationId: doc.id,
                name: doc.name,
                replaceImportId,
              },
              { onError },
            );
          }
          launchContextRef.current.onComplete?.();
        }}
      >
        {({ isLoading, openPicker }) => {
          openPickerRef.current = openPicker;
          return children({
            isLoading:
              isLoading ||
              statusQuery.isLoading ||
              !!connectingFrom ||
              tokenMutation.isPending ||
              selectMutation.isPending ||
              importOnceMutation.isPending,
            open: (context) => {
              launchContextRef.current = context ?? {};
              setIsChooserOpen(true);
            },
          });
        }}
      </SlidePicker>

      <IntegrationAccountChooser
        isOpen={isChooserOpen}
        onClose={() => setIsChooserOpen(false)}
        name="Google"
        icon={(className) => <FcGoogle className={className} />}
        accounts={accounts.map((account) => ({
          id: account.id,
          label: account.label,
          sublabel: account.displayName,
        }))}
        onChoose={(connectionId) => {
          setIsChooserOpen(false);
          void openWithAccount(connectionId);
        }}
        connect={{
          description: GOOGLE_CONNECT_DESCRIPTION,
          onClick: () => {
            setIsChooserOpen(false);
            startConnect();
          },
        }}
        onImportOnce={() => {
          setIsChooserOpen(false);
          importOnce();
        }}
        disconnect={{
          description: GOOGLE_DISCONNECT_DESCRIPTION,
          onConfirm: async (connectionId) => {
            try {
              await disconnectMutation.mutateAsync({ pluginId, connectionId });
            } catch (err: any) {
              pluginApi.remote.toast.error(
                err?.message ?? "Could not disconnect the Google account.",
              );
            }
            await refetchStatus();
          },
        }}
      />
    </>
  );
};

/**
 * Studio: the cloud stores the connections. Google won't run its sign-in or
 * picker on a localhost origin or inside the desktop shell, so both happen on
 * a cloud page in the system browser, and we poll for the pick.
 */
const RemoteGoogleSlides = ({ children }: IntegrationControllerProps) => {
  const pluginApi = usePluginAPI();
  const pluginId = pluginApi.pluginContext.pluginId;

  // Same query as the parent, so this shares its cache
  const accountsQuery = trpc.slides.googleSlidesStatus.useQuery({ pluginId });
  const accounts =
    accountsQuery.data?.mode === "remote" ? accountsQuery.data.accounts : [];
  const refetchAccounts = accountsQuery.refetch;

  const [isChooserOpen, setIsChooserOpen] = useState(false);
  const [pending, setPending] = useState<{
    intentId: string;
    mode: RemotePickMode;
    startedAt: number;
    context: IntegrationLaunchContext;
  } | null>(null);
  const launchContextRef = useRef<IntegrationLaunchContext>({});

  // Effects can run twice for one result; import it once
  const handledIntentRef = useRef<string | null>(null);

  const beginMutation = trpc.slides.googleSlidesBeginPick.useMutation();
  const selectMutation = trpc.slides.selectGoogleSlide.useMutation();
  const importOnceMutation = trpc.slides.googleSlidesImportOnce.useMutation();
  const disconnectMutation = trpc.slides.googleSlidesDisconnect.useMutation();

  const statusQuery = trpc.slides.googleSlidesPickStatus.useQuery(
    { pluginId, intentId: pending?.intentId ?? "" },
    { enabled: !!pending, refetchInterval: PICK_POLL_MS, retry: false },
  );

  useEffect(() => {
    if (!pending) return;

    if (statusQuery.error) {
      setPending(null);
      pluginApi.remote.toast.error(statusQuery.error.message);
      return;
    }

    const data = statusQuery.data;
    if (data?.status === "done" && data.result) {
      setPending(null);
      if (handledIntentRef.current === pending.intentId) return;
      handledIntentRef.current = pending.intentId;

      const { result } = data;
      const common = {
        pluginId,
        presentationId: result.presentationId,
        name: result.name ?? undefined,
        replaceImportId: pending.context.replaceImportId,
      };
      const onError = (err: { message: string }) =>
        pluginApi.remote.toast.error(err.message);

      if (result.connectionId) {
        selectMutation.mutate(
          { ...common, connectionId: result.connectionId },
          { onError },
        );
      } else if (result.accessToken) {
        // "Import once": the cloud handed back a short-lived token instead
        importOnceMutation.mutate(
          { ...common, token: result.accessToken },
          { onError },
        );
      }
      // A new account may have been connected on the way
      void refetchAccounts();
      pending.context.onComplete?.();
      return;
    }
    if (data?.status === "failed") {
      setPending(null);
      pluginApi.remote.toast.error(data.error ?? "Google Slides failed.");
      return;
    }
    if (Date.now() - pending.startedAt > PICK_TIMEOUT_MS) {
      setPending(null);
    }
  }, [
    pending,
    statusQuery.data,
    statusQuery.error,
    selectMutation,
    importOnceMutation,
    refetchAccounts,
    pluginId,
    pluginApi,
  ]);

  const begin = useCallback(
    async (mode: RemotePickMode, connectionId?: string) => {
      setIsChooserOpen(false);
      const claimed = claimExternalWindow();
      try {
        const { intentId, url } = await beginMutation.mutateAsync({
          pluginId,
          mode,
          connectionId,
        });
        await openExternally(claimed, url);
        setPending({
          intentId,
          mode,
          startedAt: Date.now(),
          context: launchContextRef.current,
        });
        pluginApi.remote.toast.info(
          mode === "pick"
            ? "Choose your presentation in the browser window that just opened."
            : "Sign in to Google in the browser window that just opened.",
        );
      } catch (err: any) {
        claimed?.close();
        pluginApi.remote.toast.error(
          err?.message ?? "Could not start Google Slides.",
        );
      }
    },
    [beginMutation, pluginId, pluginApi],
  );

  return (
    <>
      {children({
        // Not while a pick waits on the browser: if that tab was closed,
        // clicking again starts over rather than waiting it out
        isLoading:
          beginMutation.isPending ||
          selectMutation.isPending ||
          importOnceMutation.isPending,
        open: (context) => {
          launchContextRef.current = context ?? {};
          setIsChooserOpen(true);
        },
      })}

      <IntegrationAccountChooser
        isOpen={isChooserOpen}
        onClose={() => setIsChooserOpen(false)}
        name="Google"
        icon={(className) => <FcGoogle className={className} />}
        accounts={accounts.map((account) => ({
          id: account.id,
          label: account.label,
          sublabel: account.displayName,
        }))}
        onChoose={(connectionId) => void begin("pick", connectionId)}
        connect={{
          description: GOOGLE_CONNECT_DESCRIPTION,
          onClick: () => void begin("connect"),
        }}
        onImportOnce={() => void begin("once")}
        disconnect={{
          description: GOOGLE_DISCONNECT_DESCRIPTION,
          onConfirm: async (connectionId) => {
            try {
              await disconnectMutation.mutateAsync({ pluginId, connectionId });
            } catch (err: any) {
              pluginApi.remote.toast.error(
                err?.message ?? "Could not disconnect the Google account.",
              );
            }
            await refetchAccounts();
          },
        }}
      />
    </>
  );
};

export const googleSlidesIntegration: SlideIntegration = {
  ...googleSlidesBrand,
  Controller: GoogleSlidesController,
};
