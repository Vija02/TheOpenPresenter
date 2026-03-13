import { media } from "@repo/backend-shared";
import {
  constructMediaName,
  extractMediaName,
  uuidFromMediaId,
} from "@repo/lib";
import { logger } from "@repo/observability";
import ffmpegPath from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import ffmpeg from "fluent-ffmpeg";
import { readdirSync } from "fs";
import { Task } from "graphile-worker";
import fs, { createReadStream, mkdirSync, rmdirSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import os from "os";
import path from "path";
import { typeidUnboxed } from "typeid-js";

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}
ffmpeg.setFfprobePath(ffprobe.path);

const baseDir = path.join(os.tmpdir(), "videoTranscode");

const extractMetadata = (inputPath: string) => {
  return new Promise<{
    width?: number;
    height?: number;
    duration?: number;
    bitrate?: number;
  }>((resolve, reject) =>
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      const videoStream = metadata.streams.find(
        (stream) => stream.codec_type === "video",
      );
      if (!videoStream) {
        reject(new Error("No video stream found"));
        return;
      }

      resolve({
        width: videoStream.width,
        height: videoStream.height,
        duration: metadata.format.duration,
        bitrate: metadata.format.bit_rate,
      });
    }),
  );
};

interface MediasTranscodeVideoToHLSPayload {
  /**
   * Media id
   */
  id: string;
}

const HLS_SEGMENT_DURATION = 10;

// Ordered smallest to largest - important so we process smallest first so users can start viewing ASAP
const allResolutions = [
  {
    title: "360p",
    threshold: 360,
    resolution: "640x360",
    videoBitrate: "800k",
    audioBitrate: "96k",
    bandwidth: "958000",
  },
  {
    title: "480p",
    threshold: 480,
    resolution: "842x480",
    videoBitrate: "1400k",
    audioBitrate: "128k",
    bandwidth: "1635000",
  },
  {
    title: "720p",
    threshold: 720,
    resolution: "1280x720",
    videoBitrate: "2800k",
    audioBitrate: "128k",
    bandwidth: "3134000",
  },
  {
    title: "1080p",
    threshold: 1080,
    resolution: "1920x1080",
    videoBitrate: "5000k",
    audioBitrate: "192k",
    bandwidth: "5565000",
  },
];

// Types for detailed progress tracking
type TranscodeStatus = "pending" | "processing" | "completed" | "failed";
type TranscodeStage =
  | "pending"
  | "downloading"
  | "transcoding"
  | "uploading"
  | "finalizing"
  | "completed";

interface TranscodeProgressUpdate {
  status?: TranscodeStatus;
  progress?: number;
  stage?: TranscodeStage;
  stageProgress?: number;
  currentResolution?: string | null;
  completedResolutions?: string[];
}

// Helper to update transcode progress in the database
const updateTranscodeProgress = async (
  withPgClient: (callback: (pgClient: any) => Promise<void>) => Promise<void>,
  mediaId: string,
  update: TranscodeProgressUpdate,
) => {
  await withPgClient(async (pgClient) => {
    const sets: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (update.status !== undefined) {
      sets.push(`transcode_status = $${paramIndex++}`);
      values.push(update.status);
    }
    if (update.progress !== undefined) {
      sets.push(`transcode_progress = $${paramIndex++}`);
      values.push(Math.min(100, Math.max(0, Math.round(update.progress))));
    }
    if (update.stage !== undefined) {
      sets.push(`transcode_stage = $${paramIndex++}`);
      values.push(update.stage);
    }
    if (update.stageProgress !== undefined) {
      sets.push(`transcode_stage_progress = $${paramIndex++}`);
      values.push(Math.min(100, Math.max(0, Math.round(update.stageProgress))));
    }
    if (update.currentResolution !== undefined) {
      sets.push(`transcode_current_resolution = $${paramIndex++}`);
      values.push(update.currentResolution);
    }
    if (update.completedResolutions !== undefined) {
      sets.push(`transcode_completed_resolutions = $${paramIndex++}::jsonb`);
      values.push(JSON.stringify(update.completedResolutions));
    }

    if (sets.length === 0) return;

    values.push(mediaId);
    await pgClient.query(
      `UPDATE app_public.media_video_metadata 
       SET ${sets.join(", ")} 
       WHERE video_media_id = $${paramIndex}`,
      values,
    );
  });
};

const task: Task = async (inPayload, { withPgClient }) => {
  const payload: MediasTranscodeVideoToHLSPayload = inPayload as any;
  const { id: mediaId } = payload;

  try {
    let mediaDir: string = "";
    let localFilePath: string = "";

    // Update status to processing, stage to downloading
    await updateTranscodeProgress(withPgClient, mediaId, {
      status: "processing",
      progress: 0,
      stage: "downloading",
      stageProgress: 0,
    });

    // Let's get the info first
    const { mediaRow, existingThumbnailMediaId } = await withPgClient(
      async (pgClient) => {
        const {
          rows: [mediaRow],
        } = await pgClient.query(
          `select * from app_public.medias where id = $1`,
          [mediaId],
        );

        if (!mediaRow) {
          logger.error(
            { mediaId },
            "Error transcoding HLS because media not found",
          );
          throw new Error("Missing media");
        }

        const {
          rows: [mediaVideoMetadataRow],
        } = await pgClient.query(
          `select * from app_public.media_video_metadata where video_media_id = $1`,
          [mediaId],
        );

        // Don't transcode again if it's already done
        if (mediaVideoMetadataRow?.transcode_status === "completed") {
          throw {
            code: "TRANSCODE_SKIP",
            message:
              "Skipping transcode task since it video has already been transcoded",
          };
        }

        const mediaName = mediaRow.media_name;
        const existingThumbnailMediaId =
          mediaVideoMetadataRow?.thumbnail_media_id;
        mediaDir = path.join(baseDir, mediaName);

        fs.mkdirSync(mediaDir, { recursive: true });

        localFilePath = path.join(mediaDir, mediaName);

        // Download file if doesn't exist yet
        if (!fs.existsSync(localFilePath)) {
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
              "Failed to download file for converting to HLS",
            );
            throw error;
          }
        }

        return { mediaRow, existingThumbnailMediaId };
      },
    );

    const metadata = await extractMetadata(localFilePath);

    // Generate and upload thumbnail first so users can see a preview
    // Skip if thumbnail was already generated
    if (!existingThumbnailMediaId) {
      logger.trace({ mediaId }, "Starting processing thumbnail");
      const { mediaId: thumbnailMediaId, mediaName: thumbnailMediaName } =
        await generateThumbnail({
          inputPath: localFilePath,
          folder: mediaDir,
        });
      const thumbnailFilePath = path.join(mediaDir, thumbnailMediaName);
      const thumbnailFileSize = fs.statSync(thumbnailFilePath).size;
      await withPgClient(async (pgClient) => {
        const mediaHandler = new media[
          process.env.STORAGE_TYPE as "file" | "s3"
        ].mediaHandler(pgClient);

        await mediaHandler.uploadMedia({
          file: createReadStream(thumbnailFilePath),
          userId: mediaRow.user_id,
          organizationId: mediaRow.organization_id,
          isUserUploaded: false,
          fileSize: thumbnailFileSize,
          fileExtension: "jpg",
          mediaId: thumbnailMediaId,
        });
        await mediaHandler.createDependency(
          mediaId,
          uuidFromMediaId(thumbnailMediaId),
        );
        await pgClient.query(
          `UPDATE app_public.media_video_metadata 
           SET thumbnail_media_id = $2, duration = $3
           WHERE video_media_id = $1`,
          [mediaId, uuidFromMediaId(thumbnailMediaId), metadata.duration],
        );
      });
      logger.trace(
        { mediaId, thumbnailMediaName },
        "Finished processing thumbnail",
      );
    } else {
      logger.trace(
        { mediaId, existingThumbnailMediaId },
        "Thumbnail already exists, skipping generation",
      );
    }

    const minResolution = Math.min(
      metadata.height ?? Infinity,
      metadata.width ?? Infinity,
    );
    const resolutions = allResolutions.filter(
      (x) => x.threshold <= minResolution,
    );

    const resolutionMapToFile: Record<string, string> = {};

    // Pre-generate all m3u8 filenames
    const resolutionM3u8Files: Record<string, string> = {};
    for (const resolutionData of resolutions) {
      resolutionM3u8Files[resolutionData.title] =
        typeidUnboxed("media") + ".m3u8";
    }

    const masterMediaId = typeidUnboxed("media");
    const masterFilePath = path.join(mediaDir, masterMediaId + ".m3u8");
    const masterUuid = uuidFromMediaId(masterMediaId);

    // Now we can handle each resolution m3u8

    // Calculate progress: 90% for transcoding+uploading (split across resolutions), 10% for finalization
    const transcodeProgressWeight = 90;
    const perResolutionWeight = transcodeProgressWeight / resolutions.length;
    const completedResolutions: string[] = [];

    for (let i = 0; i < resolutions.length; i++) {
      const resolutionData = resolutions[i]!;
      const resolutionBaseProgress = i * perResolutionWeight;

      logger.trace(
        { mediaId, localFilePath, resolution: resolutionData.title },
        "Starting to process resolution",
      );
      const resolutionDir = path.join(mediaDir, resolutionData.title);
      mkdirSync(resolutionDir, { recursive: true });

      // Update progress to show we're starting this resolution
      await updateTranscodeProgress(withPgClient, mediaId, {
        progress: resolutionBaseProgress,
        stage: "transcoding",
        stageProgress: 0,
        currentResolution: resolutionData.title,
        completedResolutions,
      });

      // Let's check if this already exist, maybe because the process failed beforehand
      const contents = readdirSync(resolutionDir);
      if (contents.length > 0) {
        // If it's done, we can skip this and move on
        // Renaming the m3u8 file is the last step. So if it has been renamed, we know this ran successfully
        const existingM3u8File = contents.find((x) =>
          x.match(/^media(.+).m3u8$/),
        );
        if (existingM3u8File) {
          resolutionMapToFile[resolutionData.title] = existingM3u8File;
          completedResolutions.push(resolutionData.title);
          logger.trace(
            { mediaId, localFilePath, resolution: resolutionData.title },
            "This resolution has been transcoded, skipping",
          );

          // Update progress to reflect this resolution is complete
          await updateTranscodeProgress(withPgClient, mediaId, {
            progress: resolutionBaseProgress + perResolutionWeight,
            stage: "transcoding",
            stageProgress: 100,
            completedResolutions,
          });
          continue;
        }

        // Otherwise, let's nuke the contents and re-encode
        rmdirSync(resolutionDir);
        mkdirSync(resolutionDir, { recursive: true });
      }

      // Transcode
      await new Promise<void>((resolve, reject) => {
        return ffmpeg(localFilePath)
          .outputOptions([
            `-c:v libx264`,
            `-profile:v main`,
            `-level:v 4.0`,
            `-pix_fmt yuv420p`,
            `-b:v ${resolutionData.videoBitrate}`,
            `-c:a aac`,
            `-b:a ${resolutionData.audioBitrate}`,
            `-vf scale=${resolutionData.resolution}`,
            `-f hls`,
            `-hls_time ${HLS_SEGMENT_DURATION}`,
            `-hls_list_size 0`,
            `-preset medium`,
            `-crf 24`,
            `-hls_segment_filename ${resolutionDir}/%d.ts`,
          ])
          .output(`${resolutionDir}/index.m3u8`)
          .on("progress", (progress) => {
            const ffmpegPercent = progress.percent ?? 0;
            const transcodeWeight = perResolutionWeight * 0.8;
            const overallProgress =
              resolutionBaseProgress + (ffmpegPercent / 100) * transcodeWeight;
            // Update progress (don't await to avoid blocking transcoding)
            updateTranscodeProgress(withPgClient, mediaId, {
              progress: overallProgress,
              stage: "transcoding",
              stageProgress: Math.round(ffmpegPercent),
              currentResolution: resolutionData.title,
            }).catch((err) =>
              logger.warn({ err }, "Failed to update transcode progress"),
            );
          })
          .on("end", () => {
            resolve();
          })
          .on("error", (err, stdout, stderr) => {
            reject({ err, stdout, stderr });
          })
          .run();
      });
      logger.trace(
        { mediaId, localFilePath, resolution: resolutionData.title },
        "HLS files generated",
      );

      // Then we can rename everything now
      const allFiles = fs.readdirSync(resolutionDir);
      const tsFiles = allFiles.filter((x) => x.endsWith(".ts"));
      const mapping = tsFiles.map((x) => {
        const newFileName = typeidUnboxed("media") + ".ts";

        fs.renameSync(
          path.join(resolutionDir, x),
          path.join(resolutionDir, newFileName),
        );

        return { originalRegex: new RegExp(`^${x}`, "m"), newFileName };
      });

      // Now we can start replacing them inside the m3u8 file
      const m3u8File = fs
        .readFileSync(resolutionDir + "/index.m3u8")
        .toString("utf8");

      const m3u8FileFinal = mapping.reduce(
        (str, { originalRegex, newFileName }) =>
          str.replace(originalRegex, "/media/data/" + newFileName),
        m3u8File,
      );
      fs.writeFileSync(resolutionDir + "/index.m3u8", m3u8FileFinal);

      // Then let's replace the m3u8 file itself with the pre-generated filename
      const resolutionM3u8File = resolutionM3u8Files[resolutionData.title]!;

      fs.renameSync(
        path.join(resolutionDir, "index.m3u8"),
        path.join(resolutionDir, resolutionM3u8File),
      );

      resolutionMapToFile[resolutionData.title] = resolutionM3u8File;

      const transcodeWeight = perResolutionWeight * 0.8;
      const uploadWeight = perResolutionWeight * 0.2;
      await updateTranscodeProgress(withPgClient, mediaId, {
        progress: resolutionBaseProgress + transcodeWeight,
        stage: "uploading",
        stageProgress: 0,
        currentResolution: resolutionData.title,
      });

      logger.trace(
        { mediaId, localFilePath, resolution: resolutionData.title },
        "Uploading resolution files",
      );
      await withPgClient(async (pgClient) => {
        const mediaHandler = new media[
          process.env.STORAGE_TYPE as "file" | "s3"
        ].mediaHandler(pgClient);

        const allFilesToUpload = fs.readdirSync(resolutionDir);
        const m3u8FileToUpload = allFilesToUpload.find((x) =>
          x.match(/^media(.+).m3u8$/),
        )!;
        const tsFilesToUpload = allFilesToUpload.filter(
          (x) => !x.match(/^media(.+).m3u8$/),
        );
        const resolutionM3u8Uuid = extractMediaName(m3u8FileToUpload).uuid;

        for (let j = 0; j < allFilesToUpload.length; j++) {
          const fileToUpload = allFilesToUpload[j]!;
          const { mediaId: mediaIdToUpload, extension: extensionToUpload } =
            extractMediaName(fileToUpload);

          const fileSizeToUpload = fs.statSync(
            path.join(resolutionDir, fileToUpload),
          ).size;

          await mediaHandler.uploadMedia({
            file: createReadStream(path.join(resolutionDir, fileToUpload)),
            userId: mediaRow.user_id,
            organizationId: mediaRow.organization_id,
            isUserUploaded: false,
            fileSize: fileSizeToUpload,
            fileExtension: extensionToUpload,
            mediaId: mediaIdToUpload,
          });

          // Update upload progress within this resolution
          const uploadStageProgress = ((j + 1) / allFilesToUpload.length) * 100;
          const overallProgress =
            resolutionBaseProgress +
            transcodeWeight +
            (uploadStageProgress / 100) * uploadWeight;
          await pgClient.query(
            `UPDATE app_public.media_video_metadata 
             SET transcode_progress = $1, transcode_stage_progress = $2 
             WHERE video_media_id = $3`,
            [
              Math.round(overallProgress),
              Math.round(uploadStageProgress),
              mediaId,
            ],
          );
        }

        // Create dependencies immediately after uploading this resolution's files
        // Link each .ts file to the resolution's m3u8
        for (const tsFile of tsFilesToUpload) {
          await mediaHandler.createDependency(
            resolutionM3u8Uuid,
            extractMediaName(tsFile).uuid,
          );
        }

        logger.trace(
          { mediaId, resolution: resolutionData.title },
          "Created media dependencies for .ts files to resolution m3u8",
        );
      });

      // Mark this resolution as completed
      completedResolutions.push(resolutionData.title);

      const completedProgress = (i + 1) * perResolutionWeight;
      await updateTranscodeProgress(withPgClient, mediaId, {
        progress: completedProgress,
        stage: "transcoding",
        stageProgress: 0,
        currentResolution:
          i + 1 < resolutions.length ? resolutions[i + 1]!.title : null,
        completedResolutions,
      });

      logger.trace(
        { mediaId, localFilePath, resolution: resolutionData.title },
        "Done transcoding and uploading resolution",
      );
    }

    // ========================================================================== //
    // === All resolutions transcoded & uploaded, now create master m3u8 ======= //
    // ========================================================================== //
    // Update to finalizing stage
    await updateTranscodeProgress(withPgClient, mediaId, {
      progress: 90,
      stage: "finalizing",
      stageProgress: 0,
      currentResolution: null,
      completedResolutions,
    });

    // Build and upload the master m3u8 file
    let masterFileContent = `#EXTM3U\n#EXT-X-VERSION:3\n`;
    for (const resolutionData of [...resolutions].reverse()) {
      masterFileContent += `#EXT-X-STREAM-INF:BANDWIDTH=${resolutionData.bandwidth},RESOLUTION=${resolutionData.resolution}\n${`/media/data/${resolutionM3u8Files[resolutionData.title]}`}\n`;
    }
    fs.writeFileSync(masterFilePath, masterFileContent);
    const masterFileSize = fs.statSync(masterFilePath).size;

    logger.trace(
      { mediaId, localFilePath, completedResolutions },
      "Uploading master m3u8",
    );
    await withPgClient(async (pgClient) => {
      const mediaHandler = new media[
        process.env.STORAGE_TYPE as "file" | "s3"
      ].mediaHandler(pgClient);

      await mediaHandler.uploadMedia({
        file: createReadStream(masterFilePath),
        userId: mediaRow.user_id,
        organizationId: mediaRow.organization_id,
        isUserUploaded: false,
        fileSize: masterFileSize,
        fileExtension: "m3u8",
        mediaId: masterMediaId,
      });

      // Create dependency from main media to master
      await mediaHandler.createDependency(mediaId, masterUuid);

      // Create dependencies from master to each resolution's m3u8
      for (const resolutionData of resolutions) {
        const resolutionM3u8File = resolutionM3u8Files[resolutionData.title]!;
        const resolutionM3u8Uuid = extractMediaName(resolutionM3u8File).uuid;
        await mediaHandler.createDependency(masterUuid, resolutionM3u8Uuid);
      }

      logger.trace(
        { mediaId, completedResolutions },
        "Created dependencies from master m3u8 to all resolution m3u8 files",
      );
    });
    logger.trace(
      { mediaId, localFilePath, completedResolutions },
      "Done uploading master m3u8",
    );

    // Remove local files
    logger.trace({ mediaId, localFilePath }, "Deleting local files");
    fs.rmSync(localFilePath);
    fs.rmSync(mediaDir, { recursive: true });
    logger.trace({ mediaId, localFilePath }, "Local file deleted");

    // Save HLS media to the metadata table and mark as completed
    await withPgClient(async (pgClient) => {
      await pgClient.query(
        `UPDATE app_public.media_video_metadata 
         SET transcode_status = 'completed', transcode_progress = 100, hls_media_id = $2
         WHERE video_media_id = $1`,
        [mediaId, masterUuid],
      );
    });
  } catch (err: any) {
    if (err?.code === "TRANSCODE_SKIP") {
      logger.info(
        { mediaId },
        "Skipping HLS transcoding since it has already been done before",
      );
      return;
    }
    // Mark as failed on error
    await updateTranscodeProgress(withPgClient, mediaId, {
      status: "failed",
      stage: "pending",
      stageProgress: 0,
    });
    logger.error({ err, mediaId }, "Failed to transcode video to HLS");
    throw err;
  }
};

async function generateThumbnail({
  inputPath,
  folder,
}: {
  inputPath: string;
  folder: string;
}) {
  const mediaId = typeidUnboxed("media");
  const mediaName = constructMediaName(mediaId, "jpg");

  return new Promise<{ mediaId: string; mediaName: string }>(
    (resolve, reject) => {
      ffmpeg(inputPath)
        .screenshot({
          timestamps: ["50%"],
          folder,
          filename: mediaName,
          size: "360x?",
        })
        .on("end", () => {
          resolve({ mediaId, mediaName });
        })
        .on("error", (err) => {
          reject(err);
        });
    },
  );
}

module.exports = task;
