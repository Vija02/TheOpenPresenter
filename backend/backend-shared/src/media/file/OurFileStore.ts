import { FileStore } from "@tus/file-store";
import { TypeId, toUUID } from "typeid-js";

import { OurDataStore } from "../OurDataStore";
import { getFileIdsToDeleteFromID } from "../dependencyRemove";
import { WithPgClient } from "../../types";

export class OurFileStore extends FileStore implements OurDataStore {
  protected withPgClient: WithPgClient;

  constructor(
    options: ConstructorParameters<typeof FileStore>[0],
    withPgClient: WithPgClient,
  ) {
    super(options);

    this.withPgClient = withPgClient;
  }

  async getReadable(id: string) {
    return super.read(id);
  }

  async complete(id: string) {
    const splittedKey = id.split(".");
    const mediaId = splittedKey[0];
    const uuid = toUUID(mediaId as TypeId<string>);

    await this.withPgClient((client) =>
      client.query(
        `UPDATE app_public.medias
          SET
            is_complete = $1
          WHERE id = $2
        `,
        [true, uuid],
      ),
    );
  }

  public async remove(id: string): Promise<void> {
    const fileIdsToDelete = await getFileIdsToDeleteFromID(
      this.withPgClient,
      id,
    );

    await Promise.all(
      fileIdsToDelete.map((fileIdToDelete) => super.remove(fileIdToDelete)),
    );
  }

  async deleteExpired(): Promise<number> {
    if (this.getExpiration() === 0) {
      return 0;
    }

    const rows = await this.withPgClient(async (client) => {
      const result = await client.query(
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
      return result.rows;
    });

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
