import { media } from "@repo/backend-shared";
import { extractMediaName, uuidFromMediaId } from "@repo/lib";
import { logger } from "@repo/observability";
import ffmpeg from "fluent-ffmpeg";
import { Task } from "graphile-worker";
import fs, { createReadStream } from "node:fs";
import path from "path";
import { typeidUnboxed } from "typeid-js";

import {
  downloadMediaFile,
  getMediaInfo,
  processAndUploadThumbnail,
  updateTranscodeProgress,
} from "../transcode";

interface MediasTranscodeVideoToMP4Payload {
  id: string;
}

const resolutionPresets = [
  {
    title: "1080p",
    maxHeight: 1080,
    videoBitrate: "5000k",
    audioBitrate: "192k",
  },
  {
    title: "720p",
    maxHeight: 720,
    videoBitrate: "2800k",
    audioBitrate: "128k",
  },
  {
    title: "480p",
    maxHeight: 480,
    videoBitrate: "1400k",
    audioBitrate: "128k",
  },
];

const task: Task = async (inPayload, { withPgClient }) => {
  const payload: MediasTranscodeVideoToMP4Payload = inPayload as any;
  const { id: mediaId } = payload;

  let mediaDir: string = "";

  try {
    await updateTranscodeProgress(withPgClient, mediaId, {
      status: "processing",
      progress: 0,
      stage: "downloading",
      stageProgress: 0,
    });

    const { mediaRow, existingThumbnailMediaId } = await getMediaInfo({
      withPgClient,
      mediaId,
    });

    const { extension } = extractMediaName(mediaRow.media_name);
    const isAlreadyMp4 = extension.toLowerCase() === "mp4";

    // If already MP4, just generate thumbnail and mark complete
    if (isAlreadyMp4) {
      logger.trace({ mediaId }, "File is already MP4, skipping transcoding");

      if (!existingThumbnailMediaId) {
        const {
          mediaDir: dir,
          localFilePath,
          metadata,
        } = await downloadMediaFile({
          withPgClient,
          mediaId,
          mediaName: mediaRow.media_name,
        });
        mediaDir = dir;

        await processAndUploadThumbnail({
          withPgClient,
          videoMediaId: mediaId,
          inputPath: localFilePath,
          folder: mediaDir,
          duration: metadata.duration,
          mediaRow,
        });

        fs.rmSync(mediaDir, { recursive: true });
      }

      await withPgClient(async (pgClient) => {
        await pgClient.query(
          `UPDATE app_public.media_video_metadata 
           SET mp4_media_id = $2, transcode_status = 'completed', transcode_progress = 100
           WHERE video_media_id = $1`,
          [mediaId, mediaId],
        );
      });

      return;
    }

    // Not MP4, need to download and transcode
    const {
      mediaDir: dir,
      localFilePath,
      metadata,
    } = await downloadMediaFile({
      withPgClient,
      mediaId,
      mediaName: mediaRow.media_name,
    });
    mediaDir = dir;

    if (!existingThumbnailMediaId) {
      await processAndUploadThumbnail({
        withPgClient,
        videoMediaId: mediaId,
        inputPath: localFilePath,
        folder: mediaDir,
        duration: metadata.duration,
        mediaRow,
      });
    } else {
      logger.trace(
        { mediaId, existingThumbnailMediaId },
        "Thumbnail already exists, skipping generation",
      );
    }

    const videoHeight = metadata.height ?? 1080;
    const preset =
      resolutionPresets.find((p) => videoHeight >= p.maxHeight) ||
      resolutionPresets[resolutionPresets.length - 1]!;

    const outputHeight = Math.min(videoHeight, preset.maxHeight);
    const scaleFilter = `scale=-2:${outputHeight}`;

    const transcodedMediaId = typeidUnboxed("media");
    const transcodedFileName = `${transcodedMediaId}.mp4`;
    const transcodedFilePath = path.join(mediaDir, transcodedFileName);

    logger.trace(
      { mediaId, localFilePath, outputHeight, preset: preset.title },
      "Starting MP4 transcoding",
    );

    await updateTranscodeProgress(withPgClient, mediaId, {
      progress: 0,
      stage: "transcoding",
      stageProgress: 0,
      currentResolution: preset.title,
    });

    await new Promise<void>((resolve, reject) => {
      ffmpeg(localFilePath)
        .outputOptions([
          `-c:v libx264`,
          `-b:v ${preset.videoBitrate}`,
          `-c:a aac`,
          `-b:a ${preset.audioBitrate}`,
          `-vf ${scaleFilter}`,
          `-preset fast`,
          `-crf 23`,
          `-movflags +faststart`,
          `-pix_fmt yuv420p`,
          `-profile:v main`,
          `-level:v 4.0`,
        ])
        .output(transcodedFilePath)
        .on("progress", (progress) => {
          const ffmpegPercent = progress.percent ?? 0;
          const overallProgress = (ffmpegPercent / 100) * 80;
          updateTranscodeProgress(withPgClient, mediaId, {
            progress: overallProgress,
            stage: "transcoding",
            stageProgress: Math.round(ffmpegPercent),
            currentResolution: preset.title,
          }).catch((err) =>
            logger.warn({ err }, "Failed to update transcode progress"),
          );
        })
        .on("end", () => {
          resolve();
        })
        .on("error", (err) => {
          reject(err);
        })
        .run();
    });

    logger.trace(
      { mediaId, localFilePath, transcodedFilePath },
      "MP4 transcoding complete",
    );

    const transcodedFileSize = fs.statSync(transcodedFilePath).size;
    const transcodedUuid = uuidFromMediaId(transcodedMediaId);

    await updateTranscodeProgress(withPgClient, mediaId, {
      progress: 80,
      stage: "uploading",
      stageProgress: 0,
      currentResolution: preset.title,
    });

    await withPgClient(async (pgClient) => {
      const mediaHandler = new media[
        process.env.STORAGE_TYPE as "file" | "s3"
      ].mediaHandler(pgClient);

      logger.trace({ mediaId, transcodedFilePath }, "Uploading transcoded MP4");
      await mediaHandler.uploadMedia({
        file: createReadStream(transcodedFilePath),
        userId: mediaRow.user_id,
        organizationId: mediaRow.organization_id,
        isUserUploaded: false,
        fileSize: transcodedFileSize,
        fileExtension: "mp4",
        mediaId: transcodedMediaId,
      });
      logger.trace(
        { mediaId, transcodedFilePath },
        "Done uploading transcoded MP4",
      );

      await mediaHandler.createDependency(mediaId, transcodedUuid);
      logger.trace(
        { mediaId, transcodedUuid },
        "Created media dependency for transcoded MP4",
      );

      await pgClient.query(
        `UPDATE app_public.media_video_metadata 
         SET mp4_media_id = $2, transcode_status = 'completed', transcode_progress = 100
         WHERE video_media_id = $1`,
        [mediaId, transcodedUuid],
      );

      logger.trace({ mediaId }, "Saved video metadata to database");
    });

    logger.trace({ mediaId, localFilePath }, "Deleting local files");
    fs.rmSync(mediaDir, { recursive: true });
    logger.trace({ mediaId, localFilePath }, "Local files deleted");
  } catch (err: any) {
    if (mediaDir && fs.existsSync(mediaDir)) {
      try {
        fs.rmSync(mediaDir, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    }

    if (err?.code === "TRANSCODE_SKIP") {
      logger.info(
        { mediaId },
        "Skipping MP4 transcoding since it has already been done before",
      );
      return;
    }
    await updateTranscodeProgress(withPgClient, mediaId, {
      status: "failed",
      stage: "pending",
      stageProgress: 0,
    });
    logger.error({ err, mediaId }, "Failed to transcode video to MP4");
    throw err;
  }
};

module.exports = task;
