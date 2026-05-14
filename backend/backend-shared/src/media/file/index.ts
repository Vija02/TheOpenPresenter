import path from "path";

import { CustomKVStore } from "../customKVStore";
import { createMediaHandler, createMulterStorage } from "../factory";
import { MediaDataHandler } from "../types";
import { WithPgClient } from "../../types";
import { OurFileStore } from "./OurFileStore";

export const UPLOADS_PATH =
  process.env.UPLOADS_PATH ?? path.resolve(__dirname, "../../../uploads");

const createFileStore = (withPgClient: WithPgClient) => {
  return new OurFileStore(
    {
      directory: UPLOADS_PATH,
      configstore: new CustomKVStore(withPgClient),
      expirationPeriodInMilliseconds: 6 * 60 * 60 * 1000, // 6h
    },
    withPgClient,
  );
};

const MediaHandler = createMediaHandler(createFileStore);

export const mediaDataHandler = {
  createTusStore: createFileStore,
  mediaHandler: MediaHandler,
  multerStorage: createMulterStorage(MediaHandler),
} satisfies MediaDataHandler;
