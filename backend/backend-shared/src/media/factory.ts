import { logger } from "@repo/observability";
import { Upload } from "@tus/server";
import { backOff } from "exponential-backoff";
import { Request } from "express";
import { StorageEngine } from "multer";
import { Pool, PoolClient } from "pg";
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
      try {
        return await backOff(
          async () => {
            const finalFileName = mediaId + "." + fileExtension;

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

            // TODO: Handle when file already exists and finished
            await this.store.create(upload);
            await this.store.write(file, upload.id, 0);

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
            retry: (error, attemptNumber) => {
              logger.warn(
                { error, attemptNumber },
                "uploadMedia: Failed to upload, retrying...",
              );
              return true;
            },
          },
        );
      } catch (error) {
        logger.error(
          { error },
          "uploadMedia: Failed to upload. Throwing an error",
        );
        throw error;
      }
    }

    async deleteMedia(fullFileId: string) {
      try {
        return await backOff(
          async () => {
            await this.store.remove(fullFileId);
          },
          {
            numOfAttempts: 3,
            retry: (error, attemptNumber) => {
              logger.warn(
                { error, attemptNumber },
                "deleteMedia: Failed to delete, retrying...",
              );
              return true;
            },
          },
        );
      } catch (error) {
        logger.error(
          { error },
          "deleteMedia: Failed to delete. Throwing an error",
        );
        throw error;
      }
    }

    async completeMedia(fullFileId: string) {
      try {
        return await backOff(
          async () => {
            await this.store.complete(fullFileId);
          },
          {
            numOfAttempts: 3,
            retry: (error, attemptNumber) => {
              logger.warn(
                { error, attemptNumber },
                "completeMedia: Failed to complete, retrying...",
              );
              return true;
            },
          },
        );
      } catch (error) {
        logger.error(
          { error },
          "completeMedia: Failed to complete. Throwing an error",
        );
        throw error;
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
