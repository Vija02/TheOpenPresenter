import { Express } from "express";
import path from "path";

import { CustomKVStore } from "../customKVStore";
import { createMediaHandler, createMulterStorage } from "../factory";
import { MediaDataHandler } from "../types";
import { OurFileStore } from "./OurFileStore";

export const UPLOADS_PATH = path.resolve(`${process.cwd()}/../../uploads`);

const createFileStore = (app: Express) => {
  return new OurFileStore(
    {
      directory: UPLOADS_PATH,
      configstore: new CustomKVStore(app),
      expirationPeriodInMilliseconds: 6 * 60 * 60 * 1000, // 6h
    },
    app,
  );
};

const MediaHandler = createMediaHandler(createFileStore);

export const mediaDataHandler = {
  createTusStore: createFileStore,
  mediaHandler: MediaHandler,
  multerStorage: createMulterStorage(MediaHandler),
} satisfies MediaDataHandler;
