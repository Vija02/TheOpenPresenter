import { WithPgClient, media } from "@repo/backend-shared";
import {
  constructMediaName,
  extractMediaName,
  uuidFromMediaId,
} from "@repo/lib";
import { logger } from "@repo/observability";
import ffmpeg from "fluent-ffmpeg";
import { Task } from "graphile-worker";
import fs, { createReadStream } from "node:fs";
import path from "path";
import { typeidUnboxed } from "typeid-js";

import {
  TranscodeStatus,
  downloadSourceFile,
  extractCover,
  loudnormFilter,
  measureLoudness,
  probeAudio,
} from "../transcode";

interface MediasTranscodeAudioPayload {
  id: string;
}

interface AudioMediaRow {
  media_name: string;
  creator_user_id: string | null;
  organization_id: string;
}

const AUDIO_BITRATE = "192k";

const updateAudioMetadata = (
  withPgClient: WithPgClient,
  mediaId: string,
  update: Record<string, unknown>,
) => {
  const keys = Object.keys(update);
  return withPgClient((client) =>
    client.query(
      `UPDATE app_public.media_audio_metadata
       SET ${keys.map((key, i) => `${key} = $${i + 2}`).join(", ")}
       WHERE audio_media_id = $1`,
      [mediaId, ...keys.map((key) => update[key])],
    ),
  );
};

const setProgress = (
  withPgClient: WithPgClient,
  mediaId: string,
  progress: number,
  status?: TranscodeStatus,
) =>
  updateAudioMetadata(withPgClient, mediaId, {
    transcode_progress: Math.min(100, Math.max(0, Math.round(progress))),
    ...(status ? { transcode_status: status } : {}),
  });

/**
 * Makes a single playable file (AAC in m4a, fast start) for any audio upload,
 * evening out loudness unless the upload asked to keep its levels.
 * Also reads the tags and pulls out embedded cover art
 */
const task: Task = async (inPayload, { withPgClient }) => {
  const { id: mediaId } = inPayload as MediasTranscodeAudioPayload;

  let mediaDir = "";

  try {
    const { mediaRow, metadataRow } = await withPgClient(async (client) => {
      const {
        rows: [mediaRow],
      } = await client.query<AudioMediaRow>(
        `select * from app_public.medias where id = $1`,
        [mediaId],
      );
      const {
        rows: [metadataRow],
      } = await client.query(
        `select * from app_public.media_audio_metadata where audio_media_id = $1`,
        [mediaId],
      );
      return { mediaRow, metadataRow };
    });

    if (!mediaRow || !metadataRow) {
      logger.error({ mediaId }, "Error transcoding audio, media not found");
      throw new Error("Missing media");
    }
    if (metadataRow.transcode_status === "completed") {
      logger.info({ mediaId }, "Audio already transcoded, skipping");
      return;
    }

    const normalize: boolean = metadataRow.normalize_loudness;
    await setProgress(withPgClient, mediaId, 0, "processing");

    const download = await downloadSourceFile({
      withPgClient,
      mediaId,
      mediaName: mediaRow.media_name,
    });
    mediaDir = download.mediaDir;
    const { localFilePath } = download;

    const probe = await probeAudio(localFilePath);
    await setProgress(withPgClient, mediaId, 10);

    const mediaHandler = new media[
      process.env.STORAGE_TYPE as "file" | "s3"
    ].mediaHandler(withPgClient);

    const uploadDerived = async (
      filePath: string,
      derivedMediaId: string,
      fileExtension: string,
    ) => {
      await mediaHandler.uploadMedia({
        file: createReadStream(filePath),
        userId: mediaRow.creator_user_id ?? undefined,
        organizationId: mediaRow.organization_id,
        isUserUploaded: false,
        fileSize: fs.statSync(filePath).size,
        fileExtension,
        mediaId: derivedMediaId,
      });
      const derivedUuid = uuidFromMediaId(derivedMediaId);
      await mediaHandler.createDependency(mediaId, derivedUuid);
      return derivedUuid;
    };

    if (probe.hasCover && !metadataRow.cover_media_id) {
      const coverMediaId = typeidUnboxed("media");
      const coverPath = path.join(
        mediaDir,
        constructMediaName(coverMediaId, "jpg"),
      );
      await extractCover(localFilePath, coverPath);

      // Not worth failing the audio over
      if (fs.existsSync(coverPath)) {
        const coverUuid = await uploadDerived(coverPath, coverMediaId, "jpg");
        await updateAudioMetadata(withPgClient, mediaId, {
          cover_media_id: coverUuid,
        });
      } else {
        logger.warn({ mediaId }, "Couldn't extract the audio's cover art");
      }
    }

    const { extension } = extractMediaName(mediaRow.media_name);
    let playbackUuid: string;

    if (!normalize && extension.toLowerCase() === "mp3") {
      // Plays everywhere as it is, which saves a copy of a long recording
      playbackUuid = mediaId;
    } else {
      const measurement = normalize
        ? await measureLoudness(localFilePath)
        : null;
      const encodeFrom = normalize ? 40 : 10;
      await setProgress(withPgClient, mediaId, encodeFrom);

      const playbackMediaId = typeidUnboxed("media");
      const playbackPath = path.join(
        mediaDir,
        constructMediaName(playbackMediaId, "m4a"),
      );
      const canCopy = !normalize && probe.codec === "aac";

      await new Promise<void>((resolve, reject) => {
        const command = ffmpeg(localFilePath)
          .outputOptions([
            "-map 0:a:0",
            "-vn",
            ...(canCopy
              ? ["-c:a copy"]
              : [
                  "-c:a aac",
                  `-b:a ${AUDIO_BITRATE}`,
                  // loudnorm works at 192kHz, so bring it back down
                  "-ar 48000",
                ]),
            "-movflags +faststart",
          ])
          .output(playbackPath)
          .on("progress", (progress) => {
            const percent = progress.percent ?? 0;
            setProgress(
              withPgClient,
              mediaId,
              encodeFrom + (percent / 100) * (90 - encodeFrom),
            ).catch((err) =>
              logger.warn({ err }, "Failed to update audio progress"),
            );
          })
          .on("end", () => resolve())
          .on("error", (err) => reject(err));

        if (measurement) command.audioFilters(loudnormFilter(measurement));
        command.run();
      });

      await setProgress(withPgClient, mediaId, 90);
      playbackUuid = await uploadDerived(playbackPath, playbackMediaId, "m4a");
    }

    await updateAudioMetadata(withPgClient, mediaId, {
      playback_media_id: playbackUuid,
      duration: probe.duration ?? null,
      title: probe.title ?? null,
      artist: probe.artist ?? null,
      album: probe.album ?? null,
      transcode_status: "completed",
      transcode_progress: 100,
    });

    fs.rmSync(mediaDir, { recursive: true });
  } catch (err) {
    if (mediaDir && fs.existsSync(mediaDir)) {
      try {
        fs.rmSync(mediaDir, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    }

    await updateAudioMetadata(withPgClient, mediaId, {
      transcode_status: "failed",
    }).catch(() => undefined);
    logger.error({ err, mediaId }, "Failed to transcode audio");
    throw err;
  }
};

module.exports = task;
