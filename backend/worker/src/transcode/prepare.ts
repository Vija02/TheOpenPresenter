import { media } from "@repo/backend-shared";
import { logger } from "@repo/observability";
import fs from "node:fs";
import { pipeline } from "node:stream/promises";
import os from "os";
import path from "path";

import { VideoMetadata, extractMetadata } from "./ffmpeg";
import { WithPgClient } from "./progress";

const baseDir = path.join(os.tmpdir(), "videoTranscode");

export interface MediaRow {
  id: string;
  media_name: string;
  user_id: string;
  organization_id: string;
}

export interface MediaInfo {
  mediaRow: MediaRow;
  existingThumbnailMediaId: string | null;
}

export interface MediaInfoParams {
  withPgClient: WithPgClient;
  mediaId: string;
}

export const getMediaInfo = async ({
  withPgClient,
  mediaId,
}: MediaInfoParams): Promise<MediaInfo> => {
  return await withPgClient(async (pgClient) => {
    const {
      rows: [mediaRow],
    } = await pgClient.query(`select * from app_public.medias where id = $1`, [
      mediaId,
    ]);

    if (!mediaRow) {
      logger.error({ mediaId }, "Error transcoding because media not found");
      throw new Error("Missing media");
    }

    const {
      rows: [mediaVideoMetadataRow],
    } = await pgClient.query(
      `select * from app_public.media_video_metadata where video_media_id = $1`,
      [mediaId],
    );

    if (mediaVideoMetadataRow?.transcode_status === "completed") {
      throw {
        code: "TRANSCODE_SKIP",
        message:
          "Skipping transcode task since video has already been transcoded",
      };
    }

    const existingThumbnailMediaId =
      mediaVideoMetadataRow?.thumbnail_media_id ?? null;

    return { mediaRow, existingThumbnailMediaId };
  });
};

export interface DownloadedMedia {
  mediaDir: string;
  localFilePath: string;
  metadata: VideoMetadata;
}

export interface DownloadMediaParams {
  withPgClient: WithPgClient;
  mediaId: string;
  mediaName: string;
}

export const downloadMediaFile = async ({
  withPgClient,
  mediaId,
  mediaName,
}: DownloadMediaParams): Promise<DownloadedMedia> => {
  const mediaDir = path.join(baseDir, mediaName);
  fs.mkdirSync(mediaDir, { recursive: true });

  const localFilePath = path.join(mediaDir, mediaName);

  if (!fs.existsSync(localFilePath)) {
    await withPgClient(async (pgClient) => {
      const writeStream = fs.createWriteStream(localFilePath);
      try {
        const mediaHandler = new media[
          process.env.STORAGE_TYPE as "file" | "s3"
        ].mediaHandler(pgClient);

        const readable = await mediaHandler.store.getReadable(mediaName);

        logger.trace(
          { mediaId, mediaName, localFilePath },
          "Downloading media file",
        );
        await pipeline(readable, writeStream);
        logger.trace(
          { mediaId, mediaName, localFilePath },
          "Media file downloaded!",
        );
      } catch (error) {
        writeStream.close();
        fs.rmSync(localFilePath, { force: true });
        logger.error(
          { mediaId, mediaName, localFilePath },
          "Failed to download file for transcoding",
        );
        throw error;
      }
    });
  }

  const metadata = await extractMetadata(localFilePath);

  return {
    mediaDir,
    localFilePath,
    metadata,
  };
};

export interface PrepareMediaResult {
  mediaRow: MediaRow;
  existingThumbnailMediaId: string | null;
  mediaDir: string;
  localFilePath: string;
  metadata: VideoMetadata;
}

export interface PrepareMediaParams {
  withPgClient: WithPgClient;
  mediaId: string;
}

export const prepareMediaForTranscode = async ({
  withPgClient,
  mediaId,
}: PrepareMediaParams): Promise<PrepareMediaResult> => {
  const { mediaRow, existingThumbnailMediaId } = await getMediaInfo({
    withPgClient,
    mediaId,
  });

  const { mediaDir, localFilePath, metadata } = await downloadMediaFile({
    withPgClient,
    mediaId,
    mediaName: mediaRow.media_name,
  });

  return {
    mediaRow,
    existingThumbnailMediaId,
    mediaDir,
    localFilePath,
    metadata,
  };
};
