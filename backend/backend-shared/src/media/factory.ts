import { FileStore } from "@tus/file-store";
import { DataStore, Upload } from "@tus/server";
import { Express, Request } from "express";
import { StorageEngine } from "multer";
import path from "path";
import stream from "stream";
import { typeidUnboxed } from "typeid-js";

import { CustomKVStore } from "./customKVStore";
import { multerProcessFileName } from "./helper";
import {
  MediaDataHandler,
  MediaHandlerConstructor,
  MediaHandlerInterface,
  OurMulterRequest,
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
      extension,
      userId,
      organizationId,
      size,
      creation_date,
      id = typeidUnboxed("media"),
      originalFileName,
    }: {
      file: stream.Readable;
      extension: string;
      userId: string;
      organizationId: string;
      size: number;
      creation_date?: string;
      id?: string;
      originalFileName?: string;
    }) {
      const finalFileName = id + "." + extension;

      const upload = new Upload({
        id: finalFileName,
        offset: 0,
        size,
        creation_date,
        metadata: {
          originalFileName: originalFileName ?? null,
          userId,
          organizationId,
        },
      });

      await this.store.create(upload);
      await this.store.write(file, upload.id, 0);

      return { id, fileName: finalFileName, extension };
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
          extension: fileExtension,
          size: req.customMulterData?.uploadLength!,
          originalFileName: file.originalname,
          // These should be validated on the calling method
          userId: req.customMulterData?.userId!,
          organizationId: req.customMulterData?.organizationId!,
          id: req.customMulterData?.mediaId,
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
