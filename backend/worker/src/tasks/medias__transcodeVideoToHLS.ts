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

const allResolutions = [
  {
    title: "1080p",
    threshold: 1080,
    resolution: "1920x1080",
    videoBitrate: "5000k",
    audioBitrate: "192k",
    bandwidth: "5565000",
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
    title: "480p",
    threshold: 480,
    resolution: "842x480",
    videoBitrate: "1400k",
    audioBitrate: "128k",
    bandwidth: "1635000",
  },
  {
    title: "360p",
    threshold: 360,
    resolution: "640x360",
    videoBitrate: "800k",
    audioBitrate: "96k",
    bandwidth: "958000",
  },
];

// TODO: We need to make sure it's only run once
const task: Task = async (inPayload, { withPgClient }) => {
  const payload: MediasTranscodeVideoToHLSPayload = inPayload as any;
  const { id: mediaId } = payload;

  try {
    let mediaDir: string = "";
    let localFilePath: string = "";

    // Let's get the info first
    const { mediaRow } = await withPgClient(async (pgClient) => {
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
      if (mediaVideoMetadataRow) {
        throw {
          code: "TRANSCODE_SKIP",
          message:
            "Skipping transcode task since it video has already been transcoded",
        };
      }

      const mediaName = mediaRow.media_name;
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

      return { mediaRow };
    });

    const metadata = await extractMetadata(localFilePath);
    const minResolution = Math.min(
      metadata.height ?? Infinity,
      metadata.width ?? Infinity,
    );
    const resolutions = allResolutions.filter(
      (x) => x.threshold <= minResolution,
    );

    const resolutionMapToFile: Record<string, string> = {};

    for (const resolutionData of resolutions) {
      logger.trace(
        { mediaId, localFilePath, resolution: resolutionData.title },
        "Starting to process resolution",
      );
      const resolutionDir = path.join(mediaDir, resolutionData.title);
      mkdirSync(resolutionDir, { recursive: true });

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
          logger.trace(
            { mediaId, localFilePath, resolution: resolutionData.title },
            "This resolution has been transcoded, skipping",
          );
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
            `-c:v h264`,
            `-b:v ${resolutionData.videoBitrate}`,
            `-c:a aac`,
            `-b:a ${resolutionData.audioBitrate}`,
            `-vf scale=${resolutionData.resolution}`,
            `-f hls`,
            `-hls_time 10`,
            `-hls_list_size 0`,
            `-preset medium`,
            `-crf 24`,
            `-hls_segment_filename ${resolutionDir}/%d.ts`,
          ])
          .output(`${resolutionDir}/index.m3u8`)
          .on("end", async () => {
            resolve();
          })
          .on("error", (err) => {
            reject(err);
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

      // Then let's replace the m3u8 file itself
      const resolutionM3u8File = typeidUnboxed("media") + ".m3u8";

      fs.renameSync(
        path.join(resolutionDir, "index.m3u8"),
        path.join(resolutionDir, resolutionM3u8File),
      );

      resolutionMapToFile[resolutionData.title] = resolutionM3u8File;
      logger.trace(
        { mediaId, localFilePath, resolution: resolutionData.title },
        "Done transcoding resolution",
      );
    }

    // Now we can make a master m3u8 file
    let masterMediaId: string;
    let masterFilePath: string;

    // But again, let's check if this already exist
    const contents = readdirSync(mediaDir);
    const existingM3u8File = contents.find((x) => x.match(/^media(.+).m3u8$/));
    if (existingM3u8File) {
      // If it's done, reuse it
      masterMediaId = extractMediaName(existingM3u8File).mediaId;
      masterFilePath = path.join(mediaDir, masterMediaId + ".m3u8");
    } else {
      // Otherwise, let's create it
      let masterFile = `#EXTM3U\n#EXT-X-VERSION:3\n`;
      for (const resolutionData of resolutions) {
        masterFile += `#EXT-X-STREAM-INF:BANDWIDTH=${resolutionData.bandwidth},RESOLUTION=${resolutionData.resolution}\n${`/media/data/${resolutionMapToFile[resolutionData.title]}`}\n`;
      }

      masterMediaId = typeidUnboxed("media");
      masterFilePath = path.join(mediaDir, masterMediaId + ".m3u8");

      fs.writeFileSync(masterFilePath, masterFile);
    }
    const masterFileSize = fs.statSync(masterFilePath).size;
    const masterUuid = uuidFromMediaId(masterMediaId);

    // ========================================================================== //
    // === Transcoding is done, now we can start uploading and updating the DB == //
    // ========================================================================== //
    await withPgClient(async (pgClient) => {
      const mediaHandler = new media[
        process.env.STORAGE_TYPE as "file" | "s3"
      ].mediaHandler(pgClient);

      // Upload master file
      logger.trace({ mediaId, localFilePath }, "Uploading master m3u8");
      await mediaHandler.uploadMedia({
        file: createReadStream(masterFilePath),
        userId: mediaRow.user_id,
        organizationId: mediaRow.organization_id,
        isUserUploaded: false,
        fileSize: masterFileSize,
        fileExtension: "m3u8",
        mediaId: masterMediaId,
      });
      logger.trace({ mediaId, localFilePath }, "Done uploading master m3u8");

      // Then upload the rest
      for (const resolutionData of resolutions) {
        const resolutionDir = path.join(mediaDir, resolutionData.title);

        const allFiles = fs.readdirSync(resolutionDir);

        for (const fileToUpload of allFiles) {
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
        }
        logger.trace(
          { mediaId, localFilePath, resolution: resolutionData.title },
          "Done uploading resolution files",
        );
      }

      // Create Media Dependency
      for (const resolutionData of resolutions) {
        const resolutionDir = path.join(mediaDir, resolutionData.title);
        const resulutionFiles = fs.readdirSync(resolutionDir);
        const tsFiles = resulutionFiles.filter(
          (x) => !x.match(/^media(.+).m3u8$/),
        )!;
        const m3u8File = resulutionFiles.find((x) =>
          x.match(/^media(.+).m3u8$/),
        )!;

        const resolutionM3u8Uuid = extractMediaName(m3u8File).uuid;

        // Create for each resolution to its .ts file
        for (const tsFile of tsFiles) {
          await mediaHandler.createDependency(
            resolutionM3u8Uuid,
            extractMediaName(tsFile).uuid,
          );
        }

        // Connect the master m3u8 to each resolution
        await mediaHandler.createDependency(masterUuid, resolutionM3u8Uuid);
      }
      // Last but not least, connect the master m3u8 to the main file
      await mediaHandler.createDependency(mediaId, masterUuid);
      logger.trace(
        { mediaId, localFilePath },
        "Finished creating media dependencies",
      );

      // Get thumbnail, upload & set dependency
      logger.trace({ mediaId }, "Starting processing thumbnail");
      const { mediaId: thumbnailMediaId, mediaName: thumbnailMediaName } =
        await generateThumbnail({
          inputPath: localFilePath,
          folder: mediaDir,
        });
      const thumbnailFilePath = path.join(mediaDir, thumbnailMediaName);
      const thumbnailFileSize = fs.statSync(thumbnailFilePath).size;
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
      logger.trace(
        { mediaId, thumbnailMediaName },
        "Finished processing thumbnail",
      );

      // Remove local file
      logger.trace({ mediaId, localFilePath }, "Deleting local files");
      fs.rmSync(localFilePath);
      fs.rmSync(mediaDir, { recursive: true });
      logger.trace({ mediaId, localFilePath }, "Local file deleted");

      // Save it to the metadata table
      await pgClient.query(
        `insert into app_public.media_video_metadata(video_media_id, hls_media_id, thumbnail_media_id, duration) values($1, $2, $3, $4)`,
        [
          mediaId,
          masterUuid,
          uuidFromMediaId(thumbnailMediaId),
          metadata.duration,
        ],
      );

      // TODO: Notify
    });
  } catch (error: any) {
    if (error?.code === "TRANSCODE_SKIP") {
      logger.info(
        { mediaId },
        "Skipping HLS transcoding since it has already been done before",
      );
      return;
    }
    logger.error({ error, mediaId }, "Failed to transcode video to HLS");
    throw error;
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
