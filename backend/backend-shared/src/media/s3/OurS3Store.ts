import { logger } from "@repo/observability";
import { MetadataValue, Options, S3Store } from "@tus/s3-store";
import { type KvStore, TUS_RESUMABLE, Upload } from "@tus/utils";
import debug from "debug";
import _ from "lodash";
import fs, { promises as fsProm } from "node:fs";
import type { Readable } from "node:stream";
import { promises as streamProm } from "node:stream";
import os from "os";
import path from "path";
import { Pool, PoolClient } from "pg";
import { TypeId, toUUID } from "typeid-js";

import { OurDataStore } from "../OurDataStore";
import { CustomKVStore } from "../customKVStore";
import { getFileIdsToDeleteFromID } from "../dependencyRemove";

const log = debug("tus-node-server:stores:s3store");

export class OurS3Store extends S3Store implements OurDataStore {
  protected pgPool: Pool | PoolClient;
  protected configstore: KvStore<MetadataValue>;

  constructor(options: Options, pgPool: Pool | PoolClient) {
    super(options);

    this.pgPool = pgPool;
    this.configstore = new CustomKVStore<MetadataValue>(pgPool);
  }

  async complete(id: string) {
    // We need to consider incomplete parts
    let metadata = await this.getMetadata(id);
    let parts = await this.retrieveParts(id);
    const partNumber: number =
      parts.length > 0 ? parts[parts.length - 1]!.PartNumber! : 0;
    const nextPartNumber = partNumber + 1;

    const incompletePart = await this.downloadIncompletePart(id);

    // Update file size if needed
    if (metadata.file.size === undefined) {
      const totalPartSize = parts
        .map((x) => x?.Size ?? 0)
        .reduce((acc, val) => acc + val, 0);

      const totalSize = totalPartSize + (incompletePart?.size ?? 0);

      await this.declareUploadLength(id, totalSize);
      metadata = await this.getMetadata(id);
    }

    // Then upload the incomplete parts if needed
    if (incompletePart) {
      // We need to load this file somewhere else cause it'll be deleted in uploadPart
      // Rather that doing more work, we can just rename it
      const memoryPath = incompletePart.path + "mem";
      try {
        await fsProm.rename(incompletePart.path, memoryPath);

        const stream = fs.createReadStream(memoryPath);
        await this.uploadPart(metadata, stream, nextPartNumber);
        parts = await this.retrieveParts(id);
      } finally {
        fsProm.rm(memoryPath).catch(() => {
          /* ignore */
        });
      }
    }

    // Finish the upload
    await this.finishMultipartUpload(metadata, parts);

    // Then we can update the state
    const splittedKey = id.split(".");
    const mediaId = splittedKey[0];
    const uuid = toUUID(mediaId as TypeId<string>);

    await this.pgPool.query(
      `UPDATE app_public.medias
        SET 
          is_complete = $1
        WHERE id = $2
      `,
      [true, uuid],
    );
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

  // TODO: Skip multipart if small known size file
  protected async uploadPart(
    metadata: MetadataValue,
    readStream: fs.ReadStream | Readable,
    partNumber: number,
  ): Promise<string> {
    const filePath = this.getIncompletePartPath(metadata.file.id);
    // Before we upload, let's delete the incomplete parts
    // If nothing, then we can just ignore it
    await fsProm.rm(filePath).catch(() => {
      /* ignore */
    });
    return await super.uploadPart(metadata, readStream, partNumber);
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

  // ========================================================================== //
  // =================================== ETC ================================== //
  // ========================================================================== //

  // Don't recreate resource if it already exist
  public async create(upload: Upload) {
    const metadata = await this.getMetadata(upload.id);
    if (metadata) {
      logger.info(
        { upload, metadata },
        "S3 'create' function called for a resource that already exist",
      );
      return metadata.file;
    }

    return super.create(upload);
  }

  public async remove(id: string): Promise<void> {
    const fileIdsToDelete = await getFileIdsToDeleteFromID(this.pgPool, id);

    if (fileIdsToDelete.length > 1) {
      logger.info(
        { id, fileIdsToDelete },
        "Multiple files registered to be deleted",
      );
    }

    await Promise.all(
      fileIdsToDelete.map((fileIdToDelete) => this.removeRaw(fileIdToDelete)),
    );
  }

  async removeRaw(id: string) {
    const { "upload-id": uploadId, file } = await this.getMetadata(id);

    const isComplete = file.metadata?.isComplete;

    logger.info({ id, isComplete }, "Deleting file...");

    if (uploadId) {
      await this.client
        .abortMultipartUpload({
          Bucket: this.bucket,
          Key: id,
          UploadId: uploadId,
        })
        .catch((e) => {
          logger.warn({ id, e }, "Failed to abort multipart upload");
          /* ignore */
        });
    }

    await this.client
      .deleteObject({
        Bucket: this.bucket,
        Key: id,
      })
      .catch((e) => {
        logger.warn({ id, e }, "Failed to delete object from bucket");
        /* ignore */
      });

    await fsProm.rm(this.getIncompletePartPath(id)).catch((e) => {
      logger.warn({ id, e }, "Failed to delete local incomplete part");
      /* ignore */
    });

    const splittedKey = id.split(".");
    const mediaId = splittedKey[0];
    const uuid = toUUID(mediaId as TypeId<string>);

    // Remove metadata from DB
    await this.pgPool.query(`DELETE FROM app_public.medias WHERE id = $1`, [
      uuid,
    ]);
  }

  async deleteExpired(): Promise<number> {
    if (this.getExpiration() === 0) {
      return 0;
    }

    const { rows } = await this.pgPool.query(
      `SELECT 
          id, media_name, s3_upload_id
        FROM 
          app_public.medias 
        WHERE 
          is_complete is false AND 
          now() > created_at + (interval '1 millisecond' * $1) AND
          s3_upload_id is not null
      `,
      [this.getExpiration()],
    );

    logger.info({ rows }, "Deleting expired media");

    const promises = [];

    // Remove parts
    promises.push(
      ...rows.map((expiredUpload) => {
        return this.client
          .abortMultipartUpload({
            Bucket: this.bucket,
            Key: expiredUpload.media_name,
            UploadId: expiredUpload.s3_upload_id,
          })
          .catch((e) => {
            logger.warn(
              { e },
              "deleteExpired: Failed to abort multipart upload",
            );
            /* ignore */
          });
      }),
    );

    // Remove incomplete parts
    promises.push(
      ...rows.map((expiredUpload) =>
        fsProm
          .rm(this.getIncompletePartPath(expiredUpload.media_name))
          .catch((e) => {
            logger.warn(
              { e },
              "deleteExpired: Failed to delete local incomplete part",
            );
            /* ignore */
          }),
      ),
    );

    await Promise.all(promises);

    // Remove metadata from DB
    await Promise.all(
      _.chunk(
        rows.map((row) => row.id),
        1000,
      ).map((chunk) =>
        this.pgPool.query(`DELETE FROM app_public.medias WHERE id = ANY($1)`, [
          chunk,
        ]),
      ),
    );

    return rows.length;
  }
}
