import {
  DrivePicker,
  DrivePickerDocsView,
} from "@googleworkspace/drive-picker-react";
import { Button } from "@repo/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaGoogleDrive } from "react-icons/fa";

import { MAX_PICK_FILE_IDS } from "../../src/consts";
import type { DriveSlideVideo, GoogleSlidesImportData } from "../../src/types";
import { usePluginAPI } from "../pluginApi";
import { trpc } from "../trpc";
import type {
  OAuthResponseEvent,
  PickerPickedEvent,
} from "./ImportFile/SlidePicker";
import {
  claimExternalWindow,
  openExternally,
} from "./integrations/externalWindow";

/**
 * Drive videos in a Google Slides deck can only be downloaded once the user
 * picks them in the Google Picker. So we ask them to give us permission
 */
export const DriveVideoAccess = () => {
  const pluginApi = usePluginAPI();
  const imports = pluginApi.scene.useData((x) => x.pluginData.imports);

  const decks = useMemo(
    () =>
      Object.values(imports).filter(
        (imp): imp is GoogleSlidesImportData =>
          imp.type === "googleslides" &&
          !imp._isFetching &&
          (imp.driveVideos ?? []).some((video) => video.status !== "ready"),
      ),
    [imports],
  );

  if (decks.length === 0) return null;

  return (
    <div className="stack-col gap-2 mb-3">
      {decks.map((deck) => (
        <DeckNotice key={deck.importId} deck={deck} />
      ))}
    </div>
  );
};

const PICK_POLL_MS = 2000;
const PICK_TIMEOUT_MS = 15 * 60 * 1000;

const uniqueByFile = (videos: DriveSlideVideo[]) => [
  ...new Map(videos.map((video) => [video.fileId, video])).values(),
];

const DeckNotice = ({ deck }: { deck: GoogleSlidesImportData }) => {
  const pluginApi = usePluginAPI();
  const pluginId = pluginApi.pluginContext.pluginId;

  const statusQuery = trpc.slides.googleSlidesStatus.useQuery({ pluginId });
  const tokenMutation = trpc.slides.googleSlidesPickerToken.useMutation();
  const fetchMutation = trpc.slides.googleSlidesFetchVideos.useMutation();

  // Set while the picker is open. A null token makes it sign in by itself
  const [picker, setPicker] = useState<{
    connectionId: string | null;
    oauthToken: string | null;
  } | null>(null);
  const signInTokenRef = useRef<string | null>(null);

  const videos = uniqueByFile(deck.driveVideos ?? []);
  const toPick = videos.filter(
    (video) => video.status === "needsAccess" || video.status === "failed",
  );
  const downloading = videos.filter((video) => video.status === "downloading");
  const failed = videos.filter((video) => video.status === "failed");

  // Remote: the picker runs on a cloud page in the system browser, and we
  // poll for what was picked
  const beginMutation = trpc.slides.googleSlidesBeginPick.useMutation();
  const [pending, setPending] = useState<{
    intentId: string;
    startedAt: number;
  } | null>(null);
  const handledIntentRef = useRef<string | null>(null);
  const pickStatusQuery = trpc.slides.googleSlidesPickStatus.useQuery(
    { pluginId, intentId: pending?.intentId ?? "" },
    { enabled: !!pending, refetchInterval: PICK_POLL_MS, retry: false },
  );

  useEffect(() => {
    if (!pending) return;

    if (pickStatusQuery.error) {
      setPending(null);
      pluginApi.remote.toast.error(pickStatusQuery.error.message);
      return;
    }

    const data = pickStatusQuery.data;
    if (data?.status === "done" && data.result) {
      setPending(null);
      // Effects can run twice for one result; fetch once
      if (handledIntentRef.current === pending.intentId) return;
      handledIntentRef.current = pending.intentId;

      const { connectionId, accessToken, fileIds } = data.result;
      if (!fileIds?.length) return;
      fetchMutation.mutate(
        {
          pluginId,
          importId: deck.importId,
          fileIds,
          ...(connectionId ? { connectionId } : { token: accessToken }),
        },
        { onError: (err) => pluginApi.remote.toast.error(err.message) },
      );
      return;
    }
    if (data?.status === "failed") {
      setPending(null);
      pluginApi.remote.toast.error(data.error ?? "Google Drive failed.");
      return;
    }
    if (Date.now() - pending.startedAt > PICK_TIMEOUT_MS) {
      setPending(null);
    }
  }, [
    pending,
    pickStatusQuery.data,
    pickStatusQuery.error,
    fetchMutation,
    pluginId,
    deck.importId,
    pluginApi,
  ]);

  const openRemote = useCallback(
    async (fileIds: string[]) => {
      const claimed = claimExternalWindow();
      const connectionId = deck.googleConnectionId ?? undefined;
      try {
        const { intentId, url } = await beginMutation.mutateAsync({
          pluginId,
          // An "Import once" deck has no account to use, so sign in
          mode: connectionId ? "pick" : "once",
          connectionId,
          fileIds,
        });
        await openExternally(claimed, url);
        setPending({ intentId, startedAt: Date.now() });
        pluginApi.remote.toast.info(
          "Select the videos in the browser window that just opened.",
        );
      } catch (err: any) {
        claimed?.close();
        pluginApi.remote.toast.error(
          err?.message ?? "Could not open Google Drive.",
        );
      }
    },
    [beginMutation, deck.googleConnectionId, pluginId, pluginApi],
  );

  const open = useCallback(async () => {
    const status = statusQuery.data;
    if (status?.mode === "remote") {
      // More than one pick allows: the rest get the next one
      await openRemote(
        toPick.slice(0, MAX_PICK_FILE_IDS).map((video) => video.fileId),
      );
      return;
    }
    if (status?.mode !== "local") {
      pluginApi.remote.toast.error(
        status?.mode === "unavailable"
          ? status.reason
          : "Still checking Google Drive. Try again in a moment.",
      );
      return;
    }

    if (!status.clientId || !status.appId) {
      pluginApi.remote.toast.error("Google Drive isn't set up on this server.");
      return;
    }

    signInTokenRef.current = null;
    const connectionId = deck.googleConnectionId ?? null;
    if (connectionId) {
      try {
        const { accessToken } = await tokenMutation.mutateAsync({
          pluginId,
          connectionId,
        });
        setPicker({ connectionId, oauthToken: accessToken });
        return;
      } catch {
        // Eg. someone else's account imported it: sign in instead
      }
    }
    setPicker({ connectionId: null, oauthToken: null });
  }, [
    statusQuery.data,
    openRemote,
    toPick,
    deck.googleConnectionId,
    tokenMutation,
    pluginId,
    pluginApi,
  ]);

  const handlePicked = useCallback(
    (event: PickerPickedEvent) => {
      const current = picker;
      setPicker(null);
      const fileIds = event.detail.docs.map((doc) => doc.id);
      if (!current || fileIds.length === 0) return;

      fetchMutation.mutate(
        {
          pluginId,
          importId: deck.importId,
          fileIds,
          ...(current.connectionId
            ? { connectionId: current.connectionId }
            : { token: signInTokenRef.current ?? undefined }),
        },
        {
          onError: (err) => pluginApi.remote.toast.error(err.message),
        },
      );
    },
    [picker, fetchMutation, pluginId, deck.importId, pluginApi],
  );

  const status = statusQuery.data;
  const clientId = status?.mode === "local" ? status.clientId : null;
  const appId = status?.mode === "local" ? status.appId : null;
  const name = deck.name ?? "Google Slides";

  let message: string;
  if (downloading.length > 0) {
    message = `Copying ${count(downloading.length)} from Google Drive…`;
  } else if (failed.length > 0 && failed.length === toPick.length) {
    message = `${count(failed.length)} couldn't be copied: ${failed[0]!.error ?? "unknown error"}`;
  } else {
    message = `${count(toPick.length)} from Google Drive won't play until you give access.`;
  }

  return (
    <div className="stack-row gap-3 flex-wrap rounded-sm border border-tertiary bg-black/5 px-3 py-2 text-sm">
      <FaGoogleDrive className="shrink-0" />
      <span className="flex-1 min-w-48">
        <span className="font-semibold">{name}:</span> {message}
      </span>
      {toPick.length > 0 && (
        <Button
          size="sm"
          // On a phone, its own full-width row under the message
          className="w-full sm:w-auto"
          disabled={
            !!picker || tokenMutation.isPending || fetchMutation.isPending
          }
          onClick={() => void open()}
        >
          {failed.length > 0 && failed.length === toPick.length
            ? "Try again"
            : "Give access"}
        </Button>
      )}

      {picker && clientId && appId && (
        <DrivePicker
          client-id={clientId}
          app-id={appId}
          {...(picker.oauthToken ? { "oauth-token": picker.oauthToken } : {})}
          multiselect
          title="Select the videos to play"
          onPicked={handlePicked}
          onCanceled={() => setPicker(null)}
          onOauthError={() => setPicker(null)}
          onOauthResponse={(event: OAuthResponseEvent) => {
            signInTokenRef.current = event.detail.access_token;
          }}
        >
          <DrivePickerDocsView
            file-ids={toPick.map((video) => video.fileId).join(",")}
            mode="LIST"
          />
        </DrivePicker>
      )}
    </div>
  );
};

const count = (n: number) => (n === 1 ? "1 video" : `${n} videos`);
