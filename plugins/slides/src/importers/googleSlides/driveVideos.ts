import type { ServerPluginApi } from "@repo/base-plugin/server";
import type { LayoutVideo } from "@repo/layout";
import { logger } from "@repo/observability";
import axios from "axios";

import { loadedContext, loadedPlugins, loadedYjsData } from "../../loadedState";
import type { DriveSlideVideo, GoogleSlidesImportData } from "../../types";
import { googleUrl } from "./oauth";
import { withDriveVideo } from "./slideVideos";

/**
 * Copies a deck's Drive videos into our media so the overlay can play them.
 *
 * Our `drive.file` token can only read a Drive file once the user has picked
 * it in the Google Picker. So at import we try each video once, quietly, which
 * works when it was picked before (eg. a re-import); the rest stay
 * `needsAccess` until the user picks them from the remote.
 */

// What a browser can play straight away. Anything else needs a transcode we
// can't queue from here yet.
const EXTENSION_BY_MIME: Record<string, string> = {
  "video/mp4": "mp4",
  "video/x-m4v": "m4v",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

const MAX_BYTES = 2 * 1024 * 1024 * 1024;

class DriveAccessDenied extends Error {}

const LIMIT_REASONS = [
  "rateLimitExceeded",
  "userRateLimitExceeded",
  "downloadQuotaExceeded",
  "sharingRateLimitExceeded",
];

const isPermissionDenied = (status: number, body: unknown) => {
  if (status !== 403) return false;
  const reasons = ((body as any)?.error?.errors ?? []).map(
    (e: { reason?: string }) => e.reason,
  );
  return !reasons.some((reason: string) => LIMIT_REASONS.includes(reason));
};

const driveFileUrl = (fileId: string, query: string) =>
  googleUrl(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${query}`,
  );

const downloadDriveFile = async (fileId: string, token: string) => {
  const headers = { Authorization: `Bearer ${token}` };

  const meta = await axios.get(
    driveFileUrl(fileId, "fields=name,mimeType,size&supportsAllDrives=true"),
    { headers, validateStatus: () => true },
  );
  // Drive says 404 for files we haven't been granted. 403 is usually a
  // limit, which picking the video again won't fix
  if (meta.status === 404 || isPermissionDenied(meta.status, meta.data)) {
    throw new DriveAccessDenied("Google Drive hasn't given us this video yet.");
  }
  if (meta.status === 403) {
    throw new Error(
      "Google Drive is limiting downloads of this video. Try again later.",
    );
  }
  if (meta.status !== 200) {
    throw new Error(`Google Drive replied ${meta.status}.`);
  }

  const { mimeType, size } = meta.data as { mimeType?: string; size?: string };
  const extension = mimeType ? EXTENSION_BY_MIME[mimeType] : undefined;
  if (!extension) {
    throw new Error(
      `${mimeType ?? "This video type"} can't be played yet. Use an MP4, WebM or MOV video.`,
    );
  }
  if (size && Number(size) > MAX_BYTES) {
    throw new Error(
      "The video is larger than 2 GB. Please import the video separately.",
    );
  }

  const file = await axios.get<ArrayBuffer>(
    driveFileUrl(fileId, "alt=media&supportsAllDrives=true"),
    { headers, responseType: "arraybuffer", maxContentLength: MAX_BYTES },
  );

  return { buffer: Buffer.from(file.data), extension };
};

export const createDriveVideoFetcher = (serverPluginApi: ServerPluginApi) => {
  const getImport = (pluginId: string, importId: string) => {
    const importData = loadedPlugins[pluginId]?.pluginData.imports[importId];
    return importData?.type === "googleslides"
      ? (importData as GoogleSlidesImportData)
      : null;
  };

  const statusOf = (pluginId: string, importId: string, fileId: string) =>
    getImport(pluginId, importId)?.driveVideos?.find(
      (video) => video.fileId === fileId,
    )?.status;

  const setStatus = (
    pluginId: string,
    importId: string,
    fileId: string,
    status: DriveSlideVideo["status"],
    error: string | null = null,
  ) => {
    const importData = getImport(pluginId, importId);
    for (const video of importData?.driveVideos ?? []) {
      if (video.fileId !== fileId) continue;
      video.status = status;
      video.error = error;
    }
  };

  const addToSlides = (
    pluginId: string,
    importId: string,
    fileId: string,
    video: LayoutVideo,
  ) => {
    loadedYjsData[pluginId]?.doc?.transact(() => {
      const importData = getImport(pluginId, importId);
      if (!importData?.slideSize) return;

      // The same file can be on several slides
      for (const driveVideo of importData.driveVideos ?? []) {
        if (driveVideo.fileId !== fileId) continue;

        const key = String(driveVideo.slideIndex);
        const docs = importData.slideVideoDocs ?? {};
        importData.slideVideoDocs = {
          ...docs,
          [key]: withDriveVideo(
            docs[key],
            importData.slideSize,
            driveVideo,
            video,
            importData.slideVideos?.[key],
          ),
        };
        driveVideo.status = "ready";
        driveVideo.error = null;
      }
    });
  };

  const fetchDriveVideos = async ({
    pluginId,
    importId,
    token,
    userId,
    fileIds,
    quiet = false,
  }: {
    pluginId: string;
    importId: string;
    token: string;
    userId: string | null;
    fileIds?: string[];
    quiet?: boolean;
  }) => {
    const log = logger.child({ pluginId, importId });
    const context = loadedContext[pluginId];
    const importData = getImport(pluginId, importId);
    if (!context || !importData) return;

    // Not the ones another run is already downloading
    const wanted = new Set(
      (importData.driveVideos ?? [])
        .filter(
          (video) => video.status !== "ready" && video.status !== "downloading",
        )
        .filter((video) => !fileIds || fileIds.includes(video.fileId))
        .map((video) => video.fileId),
    );

    for (const fileId of wanted) {
      const previous =
        importData.driveVideos?.find((video) => video.fileId === fileId)
          ?.status ?? "needsAccess";
      setStatus(pluginId, importId, fileId, "downloading");

      try {
        const { buffer, extension } = await downloadDriveFile(fileId, token);
        const uploaded = await serverPluginApi.uploadMedia(buffer, extension, {
          organizationId: context.organizationId,
          userId,
          isGuest: userId == null,
          attachTo: { projectId: context.projectId, pluginId },
        });

        const title =
          importData.driveVideos?.find((video) => video.fileId === fileId)
            ?.title ?? null;

        addToSlides(pluginId, importId, fileId, {
          id: uploaded.mediaId,
          url: `/media/data/${uploaded.fileName}`,
          hlsMediaName: null,
          thumbnailMediaName: null,
          title,
          duration: null,
          thumbnailUrl: null,
        });
        log.info({ fileId }, "Drive video copied");
      } catch (err) {
        if (err instanceof DriveAccessDenied && quiet) {
          // Unless something else has moved it on meanwhile
          if (statusOf(pluginId, importId, fileId) === "downloading") {
            setStatus(pluginId, importId, fileId, previous);
          }
          continue;
        }
        log.warn({ err, fileId }, "Could not copy Drive video");
        setStatus(
          pluginId,
          importId,
          fileId,
          err instanceof DriveAccessDenied ? "needsAccess" : "failed",
          (err as Error).message,
        );
      }
    }
  };

  return { fetchDriveVideos };
};

export type DriveVideoFetcher = ReturnType<typeof createDriveVideoFetcher>;
