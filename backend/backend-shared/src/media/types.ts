import { DataStore } from "@tus/server";
import { Request } from "express";
import multer from "multer";
import stream from "stream";

import { WithPgClient } from "../types";

export interface MediaHandlerConstructor {
  new (withPgClient: WithPgClient): MediaHandlerInterface;
}

export type UploadMediaParam = {
  file: stream.Readable;
  fileExtension: string;
  fileSize: number;
  mediaId?: string;
  originalFileName?: string;
  creationDate?: string;
  isUserUploaded?: boolean;
  isGuest?: boolean;
  skipProcessing?: boolean;

  // Other meta
  userId: string | null;
  organizationId: string;
};

export interface MediaHandlerInterface {
  uploadMedia(param: UploadMediaParam): Promise<{
    mediaId: string;
    fileExtension: string;
    fileName: string;
  }>;

  deleteMedia(mediaName: string): Promise<void>;
  completeMedia(mediaName: string): Promise<void>;

  createDependency(
    parentMediaIdOrUUID: string,
    childMediaIdOrUUID: string,
  ): Promise<void>;
  attachToProject(
    mediaIdOrUUID: string,
    projectId: string,
    pluginId: string,
  ): Promise<void>;
  unlinkPlugin(
    pluginId: string,
    extraMetadata?: { mediaIdOrUUID?: string; projectId?: string },
  ): Promise<void>;

  processCompletedMedia(
    mediaName: string,
    options?: { isUserUploaded?: boolean },
  ): Promise<void>;
}

export type MediaDataHandler = {
  // To be used by tus, and also the others. This is the base store
  createTusStore: (withPgClient: WithPgClient) => DataStore;
  // Used by our server plugin API. When plugins want to upload from the server, it'll use this
  mediaHandler: new (withPgClient: WithPgClient) => MediaHandlerInterface;
  // Used for frontend to upload using multer
  multerStorage: new (withPgClient: WithPgClient) => multer.StorageEngine;
};

export type OurMulterRequest = Request & {
  customMulterData?: {
    organizationId?: string;
    projectId?: string;
    pluginId?: string;
    userId?: string;
    isGuest?: boolean;
    uploadLength?: number;
    explicitFileExtension?: string;
    mediaId?: string;
  };
};
