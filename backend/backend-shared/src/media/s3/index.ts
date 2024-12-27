import { Upload } from "@tus/server";
import { Express, Request } from "express";
import { StorageEngine } from "multer";
import stream from "stream";
import { typeidUnboxed } from "typeid-js";

import { multerProcessFileName } from "../helper";
import {
  MediaDataHandler,
  MediaHandlerInterface,
  OurMulterRequest,
} from "../types";
import { OurS3Store } from "./OurS3Store";

const createS3Store = (app: Express) => {
  return new OurS3Store(
    {
      s3ClientConfig: {
        bucket: process.env.STORAGE_S3_BUCKET!,
        region: process.env.STORAGE_S3_REGION!,
        endpoint: process.env.STORAGE_S3_ENDPOINT!,
        credentials: {
          accessKeyId: process.env.STORAGE_S3_ACCESS_KEY_ID!,
          secretAccessKey: process.env.STORAGE_S3_SECRET_ACCESS_KEY!,
        },
      },
    },
    app,
  );
};

class MediaHandler implements MediaHandlerInterface {
  s3Store: OurS3Store;

  constructor(app: Express) {
    this.s3Store = createS3Store(app);
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

    await this.s3Store.create(upload);
    await this.s3Store.write(file, upload.id, 0);

    return { id, fileName: finalFileName, extension };
  }

  async deleteMedia(fullFileId: string) {
    await this.s3Store.remove(fullFileId);
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
    const { fileExtension } = multerProcessFileName(file, req.customMulterData);

    try {
      const { fileName } = await this.mediaHandler.uploadMedia({
        file: file.stream,
        extension: fileExtension,
        size: req.customMulterData?.uploadLength,
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
  createTusStore: createS3Store,
  mediaHandler: MediaHandler,
  multerStorage: MulterFileStorage,
} satisfies MediaDataHandler;
