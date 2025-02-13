import { logger } from "@repo/observability";
import { Upload } from "@tus/server";
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
      } catch (e) {
        logger.warn({ e }, "uploadMedia: Failed to upload");
        throw e;
      }
    }

    async deleteMedia(fullFileId: string) {
      try {
        await this.store.remove(fullFileId);
      } catch (e) {
        logger.warn({ e }, "uploadMedia: Failed to delete");
        throw e;
      }
    }

    async completeMedia(fullFileId: string) {
      try {
        await this.store.complete(fullFileId);
      } catch (e) {
        logger.warn({ e }, "uploadMedia: Failed to complete");
        throw e;
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
