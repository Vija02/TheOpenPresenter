import { DataStore } from "@tus/server";
import { Request } from "express";
import multer from "multer";
import { Pool, PoolClient } from "pg";
import stream from "stream";

export interface MediaHandlerConstructor {
  new (pgPool: Pool | PoolClient): MediaHandlerInterface;
}

export type UploadMediaParam = {
  file: stream.Readable;
  fileExtension: string;
  fileSize: number;
  mediaId?: string;
  originalFileName?: string;
  creationDate?: string;
  isUserUploaded?: boolean;

  // Other meta
  userId: string;
  organizationId: string;
};

export interface MediaHandlerInterface {
  uploadMedia(param: UploadMediaParam): Promise<{
    mediaId: string;
    fileExtension: string;
    fileName: string;
  }>;

  deleteMedia(fullFileId: string): Promise<void>;
  completeMedia(fullFileId: string): Promise<void>;

  createDependency(
    parentMediaIdOrUUID: string,
    childMediaIdOrUUID: string,
  ): Promise<void>;
  attachToProject(
    mediaIdOrUUID: string,
    projectId: string,
    pluginId: string,
  ): Promise<void>;
}

export type MediaDataHandler = {
  // To be used by tus, and also the others. This is the base store
  createTusStore: (pgPool: Pool | PoolClient) => DataStore;
  // Used by our server plugin API. When plugins want to upload from the server, it'll use this
  mediaHandler: new (pgPool: Pool | PoolClient) => MediaHandlerInterface;
  // Used for frontend to upload using multer
  multerStorage: new (pgPool: Pool | PoolClient) => multer.StorageEngine;
};

export type OurMulterRequest = Request & {
  customMulterData?: {
    organizationId?: string;
    projectId?: string;
    pluginId?: string;
    userId?: string;
    uploadLength?: number;
    explicitFileExtension?: string;
    mediaId?: string;
  };
};
