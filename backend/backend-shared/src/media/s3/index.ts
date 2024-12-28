import { Express } from "express";

import { createMediaHandler, createMulterStorage } from "../factory";
import { MediaDataHandler } from "../types";
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
      expirationPeriodInMilliseconds: 6 * 60 * 60 * 1000, // 6h
    },
    app,
  );
};

const MediaHandler = createMediaHandler(createS3Store);

export const mediaDataHandler = {
  createTusStore: createS3Store,
  mediaHandler: MediaHandler,
  multerStorage: createMulterStorage(MediaHandler),
} satisfies MediaDataHandler;
