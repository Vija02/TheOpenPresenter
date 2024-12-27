import { DataStore, Upload } from "@tus/server";
import { Express, Request } from "express";
import { StorageEngine } from "multer";
import { typeidUnboxed } from "typeid-js";

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

    constructor(app: Express) {
      this.store = createStore(app);
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
        },
      });

      await this.store.create(upload);
      await this.store.write(file, upload.id, 0);

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
