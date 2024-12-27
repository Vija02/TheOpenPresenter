import { FileStore } from "@tus/file-store";
import { Express } from "express";
import path from "path";

import { CustomKVStore } from "../customKVStore";
import { createMediaHandler, createMulterStorage } from "../factory";
import { MediaDataHandler } from "../types";

export const UPLOADS_PATH = path.resolve(`${process.cwd()}/../../uploads`);

const createFileStore = (app: Express) => {
  return new FileStore({
    directory: UPLOADS_PATH,
    configstore: new CustomKVStore(app),
  });
};

const MediaHandler = createMediaHandler(createFileStore);

export const mediaDataHandler = {
  createTusStore: createFileStore,
  mediaHandler: MediaHandler,
  multerStorage: createMulterStorage(MediaHandler),
} satisfies MediaDataHandler;
