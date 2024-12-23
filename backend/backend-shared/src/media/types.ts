import { DataStore } from "@tus/server";
import { Express, Request } from "express";
import multer from "multer";
import stream from "stream";

export interface MediaHandlerInterface {
  uploadMedia({
    file,
    extension,
    userId,
    organizationId,
    id,
    originalFileName,
  }: {
    file: stream.Readable;
    extension: string;
    userId: string;
    organizationId: string;
    id?: string;
    originalFileName?: string;
  }): Promise<{
    id: string;
    fileName: string;
    extension: string;
  }>;

  deleteMedia(fullFileId: string): Promise<void>;
}

export type MediaDataHandler = {
  // To be used by tus, and also the others. This is the base store
  createTusStore: (app: Express) => DataStore;
  // Used by our server plugin API. When plugins want to upload from the server, it'll use this
  mediaHandler: new (app: Express) => MediaHandlerInterface;
  // Used for frontend to upload using multer
  multerStorage: new (app: Express) => multer.StorageEngine;
};

export type OurMulterRequest = Request & {
  customMulterData?: {
    organizationId?: string;
    userId?: string;
  };
};
