import { media } from "@repo/backend-shared";
import { uuidFromMediaId } from "@repo/lib";
import { logger } from "@repo/observability";
import fs, { createReadStream } from "node:fs";
import path from "path";

import { generateThumbnail } from "./ffmpeg";
import { WithPgClient } from "./progress";

export interface ProcessThumbnailParams {
  withPgClient: WithPgClient;
  videoMediaId: string;
  inputPath: string;
  folder: string;
  duration?: number;
  mediaRow: {
    user_id: string;
    organization_id: string;
  };
}

export const processAndUploadThumbnail = async ({
  withPgClient,
  videoMediaId,
  inputPath,
  folder,
  duration,
  mediaRow,
}: ProcessThumbnailParams) => {
  logger.trace({ videoMediaId }, "Starting processing thumbnail");

  const { mediaId: thumbnailMediaId, mediaName: thumbnailMediaName } =
    await generateThumbnail({
      inputPath,
      folder,
      duration,
    });

  const thumbnailFilePath = path.join(folder, thumbnailMediaName);
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
      videoMediaId,
      uuidFromMediaId(thumbnailMediaId),
    );

    await pgClient.query(
      `UPDATE app_public.media_video_metadata 
       SET thumbnail_media_id = $2, duration = $3
       WHERE video_media_id = $1`,
      [videoMediaId, uuidFromMediaId(thumbnailMediaId), duration],
    );
  });

  logger.trace(
    { videoMediaId, thumbnailMediaName },
    "Finished processing thumbnail",
  );
};
