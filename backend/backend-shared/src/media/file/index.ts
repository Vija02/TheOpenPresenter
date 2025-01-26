import path from "path";
import { Pool, PoolClient } from "pg";

import { CustomKVStore } from "../customKVStore";
import { createMediaHandler, createMulterStorage } from "../factory";
import { MediaDataHandler } from "../types";
import { OurFileStore } from "./OurFileStore";

export const UPLOADS_PATH = path.resolve(`${process.cwd()}/../../uploads`);

const createFileStore = (pgPool: Pool | PoolClient) => {
  return new OurFileStore(
    {
      directory: UPLOADS_PATH,
      configstore: new CustomKVStore(pgPool),
      expirationPeriodInMilliseconds: 6 * 60 * 60 * 1000, // 6h
    },
    pgPool,
  );
};

const MediaHandler = createMediaHandler(createFileStore);

export const mediaDataHandler = {
  createTusStore: createFileStore,
  mediaHandler: MediaHandler,
  multerStorage: createMulterStorage(MediaHandler),
} satisfies MediaDataHandler;
