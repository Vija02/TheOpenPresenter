import { createMediaHandler, createMulterStorage } from "../factory";
import { MediaDataHandler } from "../types";
import { WithPgClient } from "../../types";
import { OurS3Store } from "./OurS3Store";

const createS3Store = (withPgClient: WithPgClient) => {
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
        // Required for services outside AWS: https://github.com/aws/aws-sdk-js-v3/issues/6810
        // DEBT: Make this configurable
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
      },
      // Must exactly divide the client's MEDIA_UPLOAD_CHUNK_SIZE (100MB) so every
      // non-trailing multipart part is the same size. Some S3-compatible providers
      // (R2/MinIO) reject CompleteMultipartUpload otherwise with
      // "All non-trailing parts must have the same length."
      partSize: 10 * 1000 * 1000, // 10MB -> 100MB / 10MB = 10 uniform parts per chunk
      expirationPeriodInMilliseconds: 6 * 60 * 60 * 1000, // 6h
    },
    withPgClient,
  );
};

const MediaHandler = createMediaHandler(createS3Store);

export const mediaDataHandler = {
  createTusStore: createS3Store,
  mediaHandler: MediaHandler,
  multerStorage: createMulterStorage(MediaHandler),
} satisfies MediaDataHandler;
