import { FileStore } from "@tus/file-store";
import { Upload } from "@tus/server";
import { Express, Request } from "express";
import { StorageEngine } from "multer";
import path from "path";
import stream from "stream";
import { typeidUnboxed } from "typeid-js";

import { CustomKVStore } from "./customKVStore";
import {
  MediaDataHandler,
  MediaHandlerInterface,
  OurMulterRequest,
} from "./types";

export const UPLOADS_PATH = path.resolve(`${process.cwd()}/../../uploads`);

const createFileStore = (app: Express) => {
  return new FileStore({
    directory: UPLOADS_PATH,
    configstore: new CustomKVStore(app),
  });
};

class MediaHandler implements MediaHandlerInterface {
  fileStore: FileStore;

  constructor(app: Express) {
    this.fileStore = createFileStore(app);
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
    size?: number;
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

    await this.fileStore.create(upload);
    await this.fileStore.write(file, upload.id, 0);

    return { id, fileName: finalFileName, extension };
  }

  async deleteMedia(fullFileId: string) {
    await this.fileStore.remove(fullFileId);
  }
}

class MulterFileStorage implements StorageEngine {
  mediaHandler: MediaHandler;

  constructor(app: Express) {
    this.mediaHandler = new MediaHandler(app);
  }

  async _handleFile(
    req: OurMulterRequest,
    file: Express.Multer.File,
    cb: (error?: any, info?: Partial<Express.Multer.File>) => void,
  ) {
    const splittedKey = file.originalname.split(".");
    const extension = splittedKey[1];

    try {
      const { fileName } = await this.mediaHandler.uploadMedia({
        file: file.stream,
        extension: extension ?? "",
        size: file.size,
        originalFileName: file.originalname,
        // These should be validated on the calling method
        userId: req.customMulterData?.userId!,
        organizationId: req.customMulterData?.organizationId!,
      });

      cb(null, { filename: fileName });
    } catch (e) {
      cb(e);
    }
  }

  async _removeFile(
    req: Request,
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
}

export const mediaDataHandler = {
  createTusStore: createFileStore,
  mediaHandler: MediaHandler,
  multerStorage: MulterFileStorage,
} satisfies MediaDataHandler;
