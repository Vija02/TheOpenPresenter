import type { ServerPluginApi } from "@repo/base-plugin/server";

import { pluginName } from "../consts";
import { UploadLinkRow, checkUploadLink } from "./rules";

/**
 * Claims one attempt against a link and records the upload, atomically.
 */
export const claimUploadSlot = async (
  serverPluginApi: ServerPluginApi,
  {
    token,
    mediaId,
    originalName,
    uploaderName,
  }: {
    token: string;
    mediaId: string | null;
    originalName: string | null;
    uploaderName: string | null;
  },
): Promise<
  | {
      ok: true;
      link: UploadLinkRow;
      uploadId: string;
      /** The import being replaced, if this link already held a slide. */
      previousImportId: string | null;
    }
  | { ok: false; reason: ReturnType<typeof checkUploadLink> }
> => {
  const db = serverPluginApi.getDangerousRootPluginDb(pluginName);

  return await db.withTransaction(async (client) => {
    const { rows } = await client.query<UploadLinkRow>(
      `select * from upload_link where token = $1 for update`,
      [token],
    );
    const link = rows[0] ?? null;

    const check = checkUploadLink(link);
    if (!check.ok || !link) {
      return { ok: false as const, reason: check };
    }

    // Whatever is live right now is what the new upload replaces.
    let previousImportId: string | null = null;
    if (link.current_upload_id) {
      const { rows: prev } = await client.query<{ import_id: string | null }>(
        `select import_id from upload_link_upload where id = $1`,
        [link.current_upload_id],
      );
      previousImportId = prev[0]?.import_id ?? null;
    }

    const {
      rows: [upload],
    } = await client.query(
      `insert into upload_link_upload
         (upload_link_id, media_id, original_name, uploader_name)
       values ($1, $2, $3, $4)
       returning id`,
      [link.id, mediaId, originalName, uploaderName],
    );

    // Every try costs an attempt, replacement or not.
    await client.query(
      `update upload_link set attempt_count = attempt_count + 1 where id = $1`,
      [link.id],
    );

    return {
      ok: true as const,
      link,
      uploadId: upload.id,
      previousImportId,
    };
  });
};

/** Releases a claimed attempt when the import afterwards fails. */
export const releaseUploadSlot = async (
  serverPluginApi: ServerPluginApi,
  { uploadId, uploadLinkId }: { uploadId: string; uploadLinkId: string },
) => {
  const db = serverPluginApi.getDangerousRootPluginDb(pluginName);
  await db.withTransaction(async (client) => {
    await client.query(`delete from upload_link_upload where id = $1`, [
      uploadId,
    ]);
    await client.query(
      `update upload_link
       set attempt_count = greatest(0, attempt_count - 1)
       where id = $1`,
      [uploadLinkId],
    );
  });
};

/**
 * Marks the upload as the link's live slide, once its import succeeded.
 */
export const recordImportId = async (
  serverPluginApi: ServerPluginApi,
  {
    uploadId,
    importId,
    uploadLinkId,
    thumbnailMediaNames,
  }: {
    uploadId: string;
    importId: string;
    uploadLinkId: string;
    thumbnailMediaNames?: string[];
  },
) => {
  const db = serverPluginApi.getDangerousRootPluginDb(pluginName);

  await db.withTransaction(async (client) => {
    await client.query(
      `update upload_link_upload
       set import_id = $1, thumbnail_media_names = $2
       where id = $3`,
      [importId, thumbnailMediaNames ?? null, uploadId],
    );

    await client.query(
      `update upload_link_upload
       set replaced_at = now()
       where upload_link_id = $1 and id <> $2 and replaced_at is null`,
      [uploadLinkId, uploadId],
    );

    await client.query(
      `update upload_link set current_upload_id = $1 where id = $2`,
      [uploadId, uploadLinkId],
    );
  });
};
