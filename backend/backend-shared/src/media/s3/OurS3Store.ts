import { MetadataValue, Options, S3Store } from "@tus/s3-store";
import { type KvStore, TUS_RESUMABLE, Upload } from "@tus/utils";
import debug from "debug";
import { Express } from "express";
import fs, { promises as fsProm } from "node:fs";
import type { Readable } from "node:stream";
import { promises as streamProm } from "node:stream";
import os from "os";
import path from "path";

import { CustomKVStore } from "../customKVStore";

const log = debug("tus-node-server:stores:s3store");

export class OurS3Store extends S3Store {
  protected app: Express;
  protected configstore: KvStore<MetadataValue>;

  constructor(options: Options, app: Express) {
    super(options);

    this.app = app;
    this.configstore = new CustomKVStore<MetadataValue>(app);
  }

  // ========================================================================== //
  // ============== Save metadata to DB rather than an .info file ============= //
  // ========================================================================== //
  protected async getMetadata(id: string): Promise<MetadataValue> {
    const metadata = (await this.configstore.get(id))!;
    return metadata;
  }

  protected async saveMetadata(upload: Upload, uploadId: string) {
    log(`[${upload.id}] saving metadata`);
    await this.configstore.set(upload.id, {
      "upload-id": uploadId,
      "tus-version": TUS_RESUMABLE,
      file: upload,
    });
    log(`[${upload.id}] metadata file saved`);
  }

  protected async completeMetadata(upload: Upload) {
    if (!this.shouldUseExpirationTags()) {
      return;
    }

    const { "upload-id": uploadId } = await this.getMetadata(upload.id);
    await this.configstore.set(upload.id, {
      "upload-id": uploadId,
      "tus-version": TUS_RESUMABLE,
      file: upload,
    });
  }

  // ========================================================================== //
  // ===== Save incomplete parts in filesystem rather than directly to S3 ===== //
  // ========================================================================== //

  // Our own function to help get the part path
  // TODO: Make this configurable
  protected getIncompletePartPath(id: string) {
    const partKey = this.partKey(id, true);
    const filePath = path.join(os.tmpdir(), partKey);

    return filePath;
  }

  protected async uploadPart(
    metadata: MetadataValue,
    readStream: fs.ReadStream | Readable,
    partNumber: number,
  ): Promise<string> {
    const filePath = this.getIncompletePartPath(metadata.file.id);
    // Before we upload, let's delete the incomplete parts
    // If nothing, then we can just ignore it
    fsProm.rm(filePath).catch(() => {
      /* ignore */
    });
    return super.uploadPart(metadata, readStream, partNumber);
  }

  protected async uploadIncompletePart(
    id: string,
    readStream: fs.ReadStream | Readable,
  ): Promise<string> {
    const filePath = this.getIncompletePartPath(id);

    // DEBT: We can make this more efficient by simply appending the new data
    // However, this will require us to override the `write` function. Potentially `uploadParts` too
    await streamProm.pipeline(readStream, fs.createWriteStream(filePath));

    return "";
  }

  protected async downloadIncompletePart(id: string) {
    const filePath = this.getIncompletePartPath(id);

    try {
      const stat = await fsProm.lstat(filePath);

      // Don't cleanup since we'll clean it up later during uploadPart
      const createReadStream = (_options: { cleanUpOnEnd: boolean }) => {
        const fileReader = fs.createReadStream(filePath);

        return fileReader;
      };

      return {
        size: stat.size,
        path: filePath,
        createReader: createReadStream,
      };
    } catch (e) {
      return;
    }
  }

  protected async getIncompletePart(
    _id: string,
  ): Promise<Readable | undefined> {
    // Not used, we've overridden downloadIncompletePart
    return;
  }

  protected async getIncompletePartSize(
    id: string,
  ): Promise<number | undefined> {
    const filePath = this.getIncompletePartPath(id);

    try {
      const stat = await fsProm.lstat(filePath);

      return stat.size;
    } catch (e) {
      return undefined;
    }
  }

  protected async deleteIncompletePart(_id: string): Promise<void> {
    // Don't do anything since we'll delete it during uploadPart
    return;
  }
}
