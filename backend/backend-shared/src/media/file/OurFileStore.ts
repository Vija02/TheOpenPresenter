import { FileStore } from "@tus/file-store";
import { Express } from "express";
import { Pool } from "pg";

export class OurFileStore extends FileStore {
  protected app: Express;

  constructor(
    options: ConstructorParameters<typeof FileStore>[0],
    app: Express,
  ) {
    super(options);

    this.app = app;
  }

  async deleteExpired(): Promise<number> {
    if (this.getExpiration() === 0) {
      return 0;
    }

    const rootPgPool = this.app.get("rootPgPool") as Pool;

    const { rows } = await rootPgPool.query(
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
