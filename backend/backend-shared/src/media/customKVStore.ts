import { uuidFromPluginIdOrUUID } from "@repo/lib";
import { logger } from "@repo/observability";
import { MetadataValue } from "@tus/s3-store";
import { KvStore, TUS_RESUMABLE, Upload } from "@tus/server";
import { Pool, PoolClient } from "pg";
import { TypeId, toUUID } from "typeid-js";

export class CustomKVStore<T extends Upload | MetadataValue>
  implements KvStore<T>
{
  pgPool: Pool | PoolClient;

  constructor(pgPool: Pool | PoolClient) {
    this.pgPool = pgPool;
  }

  async get(key: string): Promise<T | undefined> {
    const splittedKey = key.split(".");

    const {
      rows: [mediaRow],
    } = await this.pgPool.query(
      "SELECT m.*, pm.project_id, pm.plugin_id FROM app_public.medias m LEFT JOIN app_public.project_medias pm ON m.id = pm.media_id WHERE id = $1",
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
        isUserUploaded: mediaRow.is_user_uploaded ? "1" : "0",
        isComplete: mediaRow.is_complete,
        projectId: mediaRow.project_id,
        pluginId: mediaRow.plugin_id,
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

    await this.pgPool.query(
      `INSERT INTO app_public.medias(
        id, media_name, file_size, file_offset, original_name, file_extension, organization_id, creator_user_id, s3_upload_id, is_user_uploaded
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO UPDATE 
      SET 
        media_name = $2,
        file_size = $3,
        file_offset = $4,
        original_name = $5,
        file_extension = $6,
        organization_id = $7,
        creator_user_id = $8,
        s3_upload_id = $9,
        is_user_uploaded = $10
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
        file.metadata?.isUserUploaded
          ? file.metadata?.isUserUploaded === "1"
          : true,
      ],
    );

    try {
      if (file.metadata?.projectId && file.metadata?.pluginId) {
        await this.pgPool.query(
          `INSERT INTO app_public.project_medias(project_id, media_id, plugin_id) values($1, $2, $3)`,
          [
            file.metadata.projectId,
            uuid,
            uuidFromPluginIdOrUUID(file.metadata.pluginId),
          ],
        );
      }
    } catch (e) {
      logger.warn(
        { error: e, mediaId: uuid, metadata: file.metadata },
        "Failed to create project_medias through Tus upload",
      );
    }
  }

  async delete(key: string): Promise<void> {
    const splittedKey = key.split(".");
    const mediaId = splittedKey[0];
    const uuid = toUUID(mediaId as TypeId<string>);

    await this.pgPool.query("DELETE FROM app_public.medias WHERE id = $1", [
      uuid,
    ]);
  }

  async list(): Promise<Array<string>> {
    const { rows } = await this.pgPool.query(
      "SELECT media_name FROM app_public.medias",
    );
    return rows.map((x) => x.media_name);
  }
}
