import { FileStore } from "@tus/file-store";
import { Pool, PoolClient } from "pg";
import { TypeId, toUUID } from "typeid-js";

import { OurDataStore } from "../OurDataStore";
import { getFileIdsToDeleteFromID } from "../dependencyRemove";

export class OurFileStore extends FileStore implements OurDataStore {
  protected pgPool: Pool | PoolClient;

  constructor(
    options: ConstructorParameters<typeof FileStore>[0],
    pgPool: Pool | PoolClient,
  ) {
    super(options);

    this.pgPool = pgPool;
  }

  async getReadable(id: string) {
    return super.read(id);
  }

  async complete(id: string) {
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

  public async remove(id: string): Promise<void> {
    const fileIdsToDelete = await getFileIdsToDeleteFromID(this.pgPool, id);

    await Promise.all(
      fileIdsToDelete.map((fileIdToDelete) => super.remove(fileIdToDelete)),
    );
  }

  async deleteExpired(): Promise<number> {
    if (this.getExpiration() === 0) {
      return 0;
    }

    const { rows } = await this.pgPool.query(
      `SELECT 
          id, media_name
        FROM 
          app_public.medias 
        WHERE 
          is_complete is false AND 
          now() > created_at + (interval '1 millisecond' * $1)
      `,
      [this.getExpiration()],
    );

    await Promise.all(
      rows.map((row) =>
        this.remove(row.media_name).catch(() => {
          /* ignore */
        }),
      ),
    );
    return rows.length;
  }
}
