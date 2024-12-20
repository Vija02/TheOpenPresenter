import { FileStore } from "@tus/file-store";
import { KvStore, Upload } from "@tus/server";
import { Express } from "express";
import path from "path";
import { Pool } from "pg";
import stream from "stream";
import { TypeId, toUUID, typeidUnboxed } from "typeid-js";

export const UPLOADS_PATH = path.resolve(`${process.cwd()}/../../uploads`);

export const createFileStore = (app: Express) => {
  return new FileStore({
    directory: UPLOADS_PATH,
    configstore: new CustomFileKvStore(app),
  });
};

export class MediaHandler {
  fileStore: FileStore;

  constructor(app: Express) {
    this.fileStore = createFileStore(app);
  }

  async uploadMedia({
    file,
    extension,
    userId,
    organizationId,
    id = typeidUnboxed("media"),
    originalFileName,
  }: {
    file: stream.Readable;
    extension: string;
    userId: string;
    organizationId: string;
    id?: string;
    originalFileName?: string;
  }) {
    const finalFileName = id + "." + extension;

    const upload = new Upload({
      id: finalFileName,
      offset: 0,
      metadata: {
        originalFileName: originalFileName ?? null,
        userId,
        organizationId,
      },
    });

    await this.fileStore.create(upload);
    await this.fileStore.write(file, upload.id, 0);

    return { id, fileName: finalFileName, extension };
  }

  async deleteMedia(fullFileId: string) {
    await this.fileStore.remove(fullFileId);
  }
}

export class CustomFileKvStore<T extends Upload> implements KvStore<T> {
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

    const newObj = {
      id: mediaRow.media_name,
      offset: mediaRow.file_offset,
      size: mediaRow.size,
      metadata: {
        originalFileName: mediaRow.original_name,
        organizationId: mediaRow.organization_id,
        userId: mediaRow.creator_user_id,
      } as any,
      storage: undefined,
      creation_date: new Date(mediaRow.created_at).toISOString(),
    } as T;

    return newObj;
  }

  async set(key: string, value: T): Promise<void> {
    const splittedKey = key.split(".");
    const mediaId = splittedKey[0];
    const uuid = toUUID(mediaId as TypeId<string>);
    const extension = splittedKey[1];

    await this.rootPgPool.query(
      `INSERT INTO app_public.medias(
        id, media_name, file_size, file_offset, original_name, file_extension, organization_id, creator_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO UPDATE 
      SET 
        media_name = $2,
        file_size = $3,
        file_offset = $4,
        original_name = $5,
        file_extension = $6,
        organization_id = $7,
        creator_user_id = $8
      `,
      [
        uuid,
        key,
        value.size,
        value.offset,
        value.metadata?.originalFileName ?? "",
        extension,
        value.metadata?.organizationId,
        value.metadata?.userId,
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
