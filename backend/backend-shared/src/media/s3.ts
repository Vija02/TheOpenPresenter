import { S3Store } from "@tus/s3-store";
import { Upload } from "@tus/server";
import { Express, Request } from "express";
import { StorageEngine } from "multer";
import stream from "stream";
import { typeidUnboxed } from "typeid-js";

import { CustomKVStore } from "./customKVStore";
import {
  MediaDataHandler,
  MediaHandlerInterface,
  OurMulterRequest,
} from "./types";

const createS3Store = (app: Express) => {
  return new S3Store({
    s3ClientConfig: {
      bucket: process.env.STORAGE_S3_BUCKET!,
      region: process.env.STORAGE_S3_REGION!,
      endpoint: process.env.STORAGE_S3_ENDPOINT!,
      credentials: {
        accessKeyId: process.env.STORAGE_S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.STORAGE_S3_SECRET_ACCESS_KEY!,
      },
    },
    // TODO: Handle this directly rather than through cache
    cache: new CustomKVStore(app),
  });
};

class MediaHandler implements MediaHandlerInterface {
  s3Store: S3Store;

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
    let fileExtension;
    if (req.customMulterData?.explicitFileExtension) {
      fileExtension = req.customMulterData.explicitFileExtension;
    } else {
      const splittedKey = file.originalname.split(".");
      if (splittedKey.length <= 1) {
        fileExtension = "";
      }
      fileExtension = splittedKey[splittedKey.length - 1]!;
    }

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
