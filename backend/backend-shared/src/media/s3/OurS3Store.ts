import { MetadataValue, Options, S3Store } from "@tus/s3-store";
import { type KvStore, TUS_RESUMABLE, Upload } from "@tus/utils";
import debug from "debug";
import { Express } from "express";

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
}
