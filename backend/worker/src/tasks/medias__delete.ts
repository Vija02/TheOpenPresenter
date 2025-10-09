import { media } from "@repo/backend-shared";
import { Task } from "graphile-worker";

interface MediasDeletePayload {
  id: string;
}

const task: Task = async (inPayload, { withPgClient }) => {
  const payload: MediasDeletePayload = inPayload as any;
  const { id: mediaId } = payload;

  await withPgClient(async (pgClient) => {
    const {
      rows: [mediaRow],
    } = await pgClient.query(
      `
        select id, media_name from app_public.medias where id = $1
      `,
      [mediaId],
    );

    // If can't find just skip. This can & often happen when we need to delete a list of media
    // And some of them are dependent on each other
    if (!mediaRow) return;

    const mediaHandler = new media[
      process.env.STORAGE_TYPE as "file" | "s3"
    ].mediaHandler(pgClient);

    await mediaHandler.deleteMedia(mediaRow.media_name);
  });
};

module.exports = task;
