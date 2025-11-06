import {
  SUPPORTED_IMAGE_EXTENSIONS,
  uuidFromMediaId,
  uuidFromMediaIdOrUUIDOrMediaName,
  uuidFromPluginIdOrUUID,
} from "@repo/lib";
import { logger } from "@repo/observability";
import { Upload } from "@tus/server";
import { backOff } from "exponential-backoff";
import { Request } from "express";
import { StorageEngine } from "multer";
import { Pool, PoolClient } from "pg";
import sharp from "sharp";
import { PassThrough } from "stream";
import { TypeId, toUUID, typeidUnboxed } from "typeid-js";

import { OurDataStore } from "./OurDataStore";
import { multerProcessFileName } from "./helper";
import {
  MediaHandlerConstructor,
  MediaHandlerInterface,
  OurMulterRequest,
  UploadMediaParam,
} from "./types";

export const createMediaHandler = <T extends OurDataStore>(
  createStore: (pgPool: Pool | PoolClient) => T,
) => {
  return class MediaHandler implements MediaHandlerInterface {
    store: T;
    pgPool: Pool | PoolClient;

    constructor(pgPool: Pool | PoolClient) {
      this.store = createStore(pgPool);
      this.pgPool = pgPool;
    }

    async uploadMedia({
      file,
      fileExtension,
      fileSize,
      userId,
      organizationId,
      creationDate,
      mediaId = typeidUnboxed("media"),
      originalFileName,
      isUserUploaded,
    }: UploadMediaParam) {
      const finalFileName = mediaId + "." + fileExtension;
      try {
        return await backOff(
          async () => {
            const upload = new Upload({
              id: finalFileName,
              offset: 0,
              size: fileSize,
              creation_date: creationDate,
              metadata: {
                originalFileName: originalFileName ?? null,
                userId,
                organizationId,
                isUserUploaded: isUserUploaded ? "1" : "0",
              },
            });

            await this.store.create(upload);
            try {
              // Debt: Make the image processing code easier to read
              const isImage = SUPPORTED_IMAGE_EXTENSIONS.includes(
                "." + fileExtension.toLowerCase(),
              );

              // Pipe to passthrough and prep to pipe to metadata
              const passthrough = new PassThrough();
              file.pipe(passthrough);

              const getMetadataPromise = new Promise<sharp.Metadata | void>(
                async (resolve, reject) => {
                  if (!isImage) {
                    resolve();
                    return;
                  }
                  file.pipe(
                    sharp().metadata((err, metadata) => {
                      if (err) reject(err);
                      resolve(metadata);
                    }),
                  );
                },
              );

              // Then we can start the stream process
              // Write to storage
              await this.store.write(passthrough, upload.id, 0);

              // If image, then let's add some metadata
              if (isImage) {
                const metadata = await getMetadataPromise;

                await this.pgPool.query(
                  `INSERT INTO app_public.media_image_metadata (image_media_id, width, height)
                    VALUES ($1, $2, $3) ON CONFLICT (image_media_id) DO UPDATE 
                    SET 
                      width = $2,
                      height = $3
                    `,
                  [uuidFromMediaId(mediaId), metadata?.width, metadata?.height],
                );
              }
            } catch (err: any) {
              if (err?.Code === "NoSuchUpload") {
                logger.warn(
                  { err },
                  "uploadMedia: File not uploaded but resolving function as normal. This probably happens because the file has already been uploaded.",
                );
                return { mediaId, fileExtension, fileName: finalFileName };
              }
              throw err;
            }

            // Update is_complete flag
            const uuid = toUUID(mediaId as TypeId<string>);
            await this.pgPool.query(
              `UPDATE app_public.medias
              SET 
                is_complete = $1
              WHERE id = $2
            `,
              [true, uuid],
            );

            return { mediaId, fileExtension, fileName: finalFileName };
          },
          {
            retry: (err, attemptNumber) => {
              logger.warn(
                { err, attemptNumber },
                "uploadMedia: Failed to upload, retrying...",
              );
              return true;
            },
          },
        );
      } catch (err) {
        logger.error(
          { err },
          "uploadMedia: Failed to upload. Throwing an error",
        );
        throw err;
      }
    }

    async deleteMedia(mediaName: string) {
      try {
        return await backOff(
          async () => {
            await this.store.remove(mediaName);
          },
          {
            numOfAttempts: 3,
            retry: (err, attemptNumber) => {
              logger.warn(
                { err, attemptNumber },
                "deleteMedia: Failed to delete, retrying...",
              );
              return true;
            },
          },
        );
      } catch (err) {
        logger.error(
          { err },
          "deleteMedia: Failed to delete. Throwing an error",
        );
        throw err;
      }
    }

    async completeMedia(mediaName: string) {
      try {
        return await backOff(
          async () => {
            await this.store.complete(mediaName);
          },
          {
            numOfAttempts: 3,
            retry: (err, attemptNumber) => {
              logger.warn(
                { err, attemptNumber },
                "completeMedia: Failed to complete, retrying...",
              );
              return true;
            },
          },
        );
      } catch (err) {
        logger.error(
          { err },
          "completeMedia: Failed to complete. Throwing an error",
        );
        throw err;
      }
    }

    async createDependency(
      parentMediaIdOrUUID: string,
      childMediaIdOrUUID: string,
    ) {
      try {
        await this.pgPool.query(
          `
          INSERT INTO app_public.media_dependencies(parent_media_id, child_media_id) values($1, $2)  
        `,
          [
            uuidFromMediaIdOrUUIDOrMediaName(parentMediaIdOrUUID),
            uuidFromMediaIdOrUUIDOrMediaName(childMediaIdOrUUID),
          ],
        );
      } catch (err: any) {
        if (err?.code === "23505") {
          logger.info(
            { err },
            "createDependency: Creating dependency failed but returning the function since it already exists",
          );
          return;
        }
        logger.error(
          { err },
          "createDependency: Failed to create media dependency",
        );
        throw err;
      }
    }

    async attachToProject(
      mediaIdOrUUID: string,
      projectId: string,
      pluginId: string,
    ) {
      try {
        await this.pgPool.query(
          `
          INSERT INTO app_public.project_medias(project_id, media_id, plugin_id) values($1, $2, $3)  
        `,
          [
            projectId,
            uuidFromMediaIdOrUUIDOrMediaName(mediaIdOrUUID),
            uuidFromPluginIdOrUUID(pluginId),
          ],
        );
      } catch (err: any) {
        logger.error(
          { err },
          "attachToProject: Failed to attach media to a project",
        );
        throw err;
      }
    }
    async unlinkPlugin(
      pluginId: string,
      extraMetadata?: { mediaIdOrUUID?: string; projectId?: string },
    ) {
      try {
        const { mediaIdOrUUID, projectId } = extraMetadata || {};

        // Build WHERE clause dynamically based on provided parameters
        const conditions = ["plugin_id = $1"];
        const params = [uuidFromPluginIdOrUUID(pluginId)];

        if (mediaIdOrUUID) {
          conditions.push("media_id = $" + (params.length + 1));
          params.push(uuidFromMediaIdOrUUIDOrMediaName(mediaIdOrUUID));
        }

        if (projectId) {
          conditions.push("project_id = $" + (params.length + 1));
          params.push(projectId);
        }

        await this.pgPool.query(
          `DELETE FROM app_public.project_medias WHERE ${conditions.join(" AND ")}`,
          params,
        );
      } catch (err: any) {
        logger.error({ err }, "unlinkPlugin: Failed to unlink plugin");
        throw err;
      }
    }
  };
};

export const createMulterStorage = (MediaHandler: MediaHandlerConstructor) => {
  return class MulterFileStorage implements StorageEngine {
    mediaHandler: MediaHandlerInterface;

    constructor(pgPool: Pool | PoolClient) {
      this.mediaHandler = new MediaHandler(pgPool);
    }

    async _handleFile(
      req: OurMulterRequest,
      file: Express.Multer.File,
      cb: (error?: any, info?: Partial<Express.Multer.File>) => void,
    ) {
      const { fileExtension } = multerProcessFileName(
        file,
        req.customMulterData,
      );

      try {
        const { fileName } = await this.mediaHandler.uploadMedia({
          file: file.stream,
          fileExtension,
          fileSize: req.customMulterData?.uploadLength!,
          originalFileName: file.originalname,
          // These should be validated on the calling method
          userId: req.customMulterData?.userId!,
          organizationId: req.customMulterData?.organizationId!,
          mediaId: req.customMulterData?.mediaId,
        });
        if (
          req.customMulterData?.mediaId &&
          req.customMulterData?.projectId &&
          req.customMulterData?.pluginId
        ) {
          await this.mediaHandler.attachToProject(
            req.customMulterData.mediaId,
            req.customMulterData.projectId,
            req.customMulterData.pluginId,
          );
        }

        cb(null, { filename: fileName });
      } catch (e) {
        cb(e);
      }
    }

    async _removeFile(
      _req: Request,
      file: Express.Multer.File,
      cb: (error?: any, info?: Partial<Express.Multer.File>) => void,
    ) {
      try {
        await this.mediaHandler.deleteMedia(file.filename);

        cb();
      } catch (e) {
        cb(e);
      }
    }
  };
};
