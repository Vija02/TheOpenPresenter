import { MetadataValue } from "@tus/s3-store";
import { KvStore, TUS_RESUMABLE, Upload } from "@tus/server";
import { Express } from "express";
import { Pool } from "pg";
import { TypeId, toUUID } from "typeid-js";

export class CustomKVStore<T extends Upload | MetadataValue>
  implements KvStore<T>
{
  rootPgPool: Pool;

  constructor(app: Express) {
    this.rootPgPool = app.get("rootPgPool") as Pool;
  }

  async get(key: string): Promise<T | undefined> {
    const splittedKey = key.split(".");

    const {
      rows: [mediaRow],
    } = await this.rootPgPool.query(
      "SELECT * FROM app_public.medias WHERE id = $1",
      [toUUID(splittedKey[0] as TypeId<string>)],
    );
    if (!mediaRow) return undefined;

    const newObj = {
      id: mediaRow.media_name,
      offset: mediaRow.file_offset,
      size: mediaRow.file_size ? parseInt(mediaRow.file_size, 10) : undefined,
      metadata: {
        originalFileName: mediaRow.original_name,
        organizationId: mediaRow.organization_id,
        userId: mediaRow.creator_user_id,
      } as any,
      storage: undefined,
      creation_date: new Date(mediaRow.created_at).toISOString(),
    } as T;

    return process.env.STORAGE_TYPE === "s3"
      ? ({
          file: newObj as Upload,
          "tus-version": TUS_RESUMABLE,
          "upload-id": mediaRow.s3_upload_id,
        } satisfies MetadataValue as T)
      : newObj;
  }

  async set(key: string, value: T): Promise<void> {
    const splittedKey = key.split(".");
    const mediaId = splittedKey[0];
    const uuid = toUUID(mediaId as TypeId<string>);
    const extension = splittedKey[1];

    const file = "file" in value ? value.file : (value as Upload);

    await this.rootPgPool.query(
      `INSERT INTO app_public.medias(
        id, media_name, file_size, file_offset, original_name, file_extension, organization_id, creator_user_id, s3_upload_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO UPDATE 
      SET 
        media_name = $2,
        file_size = $3,
        file_offset = $4,
        original_name = $5,
        file_extension = $6,
        organization_id = $7,
        creator_user_id = $8,
        s3_upload_id = $9
      `,
      [
        uuid,
        key,
        file.size,
        file.offset,
        file.metadata?.originalFileName ?? "",
        extension,
        file.metadata?.organizationId,
        file.metadata?.userId,
        "upload-id" in value ? value["upload-id"] : null,
      ],
    );
  }

  async delete(key: string): Promise<void> {
    const splittedKey = key.split(".");
    const mediaId = splittedKey[0];
    const uuid = toUUID(mediaId as TypeId<string>);

    await this.rootPgPool.query("DELETE FROM app_public.medias WHERE id = $1", [
      uuid,
    ]);
  }

  async list(): Promise<Array<string>> {
    const { rows } = await this.rootPgPool.query(
      "SELECT media_name FROM app_public.medias",
    );
    return rows.map((x) => x.media_name);
  }
}
