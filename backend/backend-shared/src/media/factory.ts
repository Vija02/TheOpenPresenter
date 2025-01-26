import { DataStore, Upload } from "@tus/server";
import { Express, Request } from "express";
import { StorageEngine } from "multer";
import { Pool } from "pg";
import { TypeId, toUUID, typeidUnboxed } from "typeid-js";

import { multerProcessFileName } from "./helper";
import {
  MediaHandlerConstructor,
  MediaHandlerInterface,
  OurMulterRequest,
  UploadMediaParam,
} from "./types";

export const createMediaHandler = <T extends DataStore>(
  createStore: (app: Express) => T,
) => {
  return class MediaHandler implements MediaHandlerInterface {
    store: T;
    app: Express;

    constructor(app: Express) {
      this.store = createStore(app);
      this.app = app;
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
      const rootPgPool = this.app.get("rootPgPool") as Pool;
      await rootPgPool.query(
        `UPDATE app_public.medias
          SET 
            is_complete = $1
          WHERE id = $2
        `,
        [true, uuid],
      );

      return { mediaId, fileExtension, fileName: finalFileName };
    }

    async deleteMedia(fullFileId: string) {
      await this.store.remove(fullFileId);
    }
  };
};

export const createMulterStorage = (MediaHandler: MediaHandlerConstructor) => {
  return class MulterFileStorage implements StorageEngine {
    mediaHandler: MediaHandlerInterface;

    constructor(app: Express) {
      this.mediaHandler = new MediaHandler(app);
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
