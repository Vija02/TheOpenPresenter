import { desktop } from "@repo/desktop-bridge";
import { useCallback, useEffect, useRef, useState } from "react";
import { FcGoogle } from "react-icons/fc";

import { googleSlidesBrand } from "../../components/integrationBranding";
import { usePluginAPI } from "../../pluginApi";
import { trpc } from "../../trpc";
import { SlidePicker } from "../ImportFile/SlidePicker";
import {
  IntegrationControllerProps,
  IntegrationLaunchContext,
  SlideIntegration,
} from "./types";
import { IntegrationAccountChooser } from "./IntegrationAccountChooser";

const PICK_POLL_MS = 2000;
const PICK_TIMEOUT_MS = 15 * 60 * 1000;

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
    setConnectingFrom({ topAccountId: accounts[0]?.id ?? null });
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
      if (event.data?.source !== "top-google-oauth") return;
      if (event.data.ok) {
        void finish({ isConfirmed: true });
      } else {
        setConnectingFrom(null);
        pluginApi.remote.toast.error(
          event.data.error ?? "Google connection failed.",
        );
      }
    };
    window.addEventListener("message", onMessage);

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
      window.removeEventListener("message", onMessage);
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
          description: "Stays connected, so you can pick again without signing in.",
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
          description:
            "You will need to connect it again to pick from its Drive. Slides you have already imported are unaffected.",
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
 * The cloud stores the connection. Google won't run its picker on a
 * localhost origin or inside the desktop shell, so the user picks on a cloud
 * page in their real browser and we poll for the result.
 */
const RemoteGoogleSlides = ({ children }: IntegrationControllerProps) => {
  const pluginApi = usePluginAPI();
  const pluginId = pluginApi.pluginContext.pluginId;

  const [pending, setPending] = useState<{
    intentId: string;
    startedAt: number;
    context: IntegrationLaunchContext;
  } | null>(null);

  // Effects can run twice for one result; import it once
  const handledIntentRef = useRef<string | null>(null);

  const beginMutation = trpc.slides.googleSlidesBeginPick.useMutation();
  const selectMutation = trpc.slides.selectGoogleSlide.useMutation();

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
      selectMutation.mutate(
        {
          pluginId,
          connectionId: data.result.connectionId,
          presentationId: data.result.presentationId,
          name: data.result.name ?? undefined,
          replaceImportId: pending.context.replaceImportId,
        },
        {
          onError: (err) => pluginApi.remote.toast.error(err.message),
        },
      );
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
    pluginId,
    pluginApi,
  ]);

  const open = useCallback(
    async (context?: IntegrationLaunchContext) => {
      // A plain browser blocks windows opened after an await, so claim one
      // now. The desktop shell opens the system browser instead.
      const placeholder = desktop.isDesktop
        ? null
        : window.open("about:blank", "_blank");

      try {
        const { intentId, url } = await beginMutation.mutateAsync({ pluginId });
        if (placeholder) {
          placeholder.location.href = url;
        } else {
          await desktop.openExternal(url);
        }
        setPending({ intentId, startedAt: Date.now(), context: context ?? {} });
        pluginApi.remote.toast.info(
          "Choose your presentation in the browser window that just opened.",
        );
      } catch (err: any) {
        placeholder?.close();
        pluginApi.remote.toast.error(
          err?.message ?? "Could not start Google Slides.",
        );
      }
    },
    [beginMutation, pluginId, pluginApi],
  );

  return children({
    isLoading: beginMutation.isPending || !!pending || selectMutation.isPending,
    open: (context) => void open(context),
  });
};

export const googleSlidesIntegration: SlideIntegration = {
  ...googleSlidesBrand,
  Controller: GoogleSlidesController,
};
