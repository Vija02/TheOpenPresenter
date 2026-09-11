import type { ServerPluginApi } from "@repo/base-plugin/server";

import { pluginName } from "../consts";
import { UploadLinkRow, checkUploadLink, generateUploadToken } from "./rules";

export const findLinkByToken = async (
  serverPluginApi: ServerPluginApi,
  token: string,
): Promise<UploadLinkRow | null> => {
  const db = serverPluginApi.getDangerousRootPluginDb(pluginName);
  const { rows } = await db.query<UploadLinkRow>(
    `select * from upload_link where token = $1`,
    [token],
  );
  return rows[0] ?? null;
};

export const isUploadLinkStillUsable = async (
  serverPluginApi: ServerPluginApi,
  uploadLinkId: string,
): Promise<boolean> => {
  const db = serverPluginApi.getDangerousRootPluginDb(pluginName);
  const { rows } = await db.query<UploadLinkRow>(
    `select * from upload_link where id = $1`,
    [uploadLinkId],
  );
  return checkUploadLink(rows[0]).ok;
};

export const createLink = async (
  serverPluginApi: ServerPluginApi,
  {
    organizationId,
    projectId,
    sceneId,
    pluginId,
    label,
    maxAttempts,
    expiresAt,
    userId,
  }: {
    organizationId: string;
    projectId: string;
    sceneId: string;
    pluginId: string;
    label?: string;
    maxAttempts?: number;
    expiresAt?: string;
    userId: string | null;
  },
): Promise<UploadLinkRow> => {
  const db = serverPluginApi.getDangerousRootPluginDb(pluginName);
  const { rows } = await db.query<UploadLinkRow>(
    `insert into upload_link
       (organization_id, project_id, scene_id, plugin_id, token, label,
        max_attempts, expires_at, created_by_user_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning *`,
    [
      organizationId,
      projectId,
      sceneId,
      pluginId,
      generateUploadToken(),
      label || null,
      maxAttempts ?? null,
      expiresAt ?? null,
      userId,
    ],
  );
  return rows[0]!;
};

export const listLinksForPlugin = async (
  serverPluginApi: ServerPluginApi,
  pluginId: string,
) => {
  const db = serverPluginApi.getDangerousRootPluginDb(pluginName);
  const { rows } = await db.query(
    `select l.*,
            (select count(*)::int from upload_link_upload u
              where u.upload_link_id = l.id) as attempts_used,
            cur.original_name as current_original_name,
            cur.uploader_name as current_uploader_name,
            cur.thumbnail_media_names as current_thumbnail_media_names,
            cur.created_at as current_uploaded_at
     from upload_link l
     left join upload_link_upload cur on cur.id = l.current_upload_id
     where l.plugin_id = $1
     order by l.created_at desc`,
    [pluginId],
  );
  return rows;
};

export const listUploadsForPlugin = async (
  serverPluginApi: ServerPluginApi,
  pluginId: string,
) => {
  const db = serverPluginApi.getDangerousRootPluginDb(pluginName);
  const { rows } = await db.query(
    `select u.id, u.original_name, u.uploader_name, u.created_at, u.import_id,
            u.thumbnail_media_names, u.replaced_at
     from upload_link_upload u
     join upload_link l on l.id = u.upload_link_id
     where l.plugin_id = $1
     order by u.created_at desc
     limit 100`,
    [pluginId],
  );
  return rows;
};

/** The upload currently live on a link, if any. */
export const findCurrentUpload = async (
  serverPluginApi: ServerPluginApi,
  link: UploadLinkRow,
): Promise<{
  original_name: string | null;
  thumbnail_media_names: string[] | null;
} | null> => {
  if (!link.current_upload_id) return null;

  const db = serverPluginApi.getDangerousRootPluginDb(pluginName);
  const { rows } = await db.query(
    `select original_name, thumbnail_media_names
     from upload_link_upload where id = $1`,
    [link.current_upload_id],
  );
  return rows[0] ?? null;
};

export const lookupOrganizationName = async (
  serverPluginApi: ServerPluginApi,
  organizationId: string,
): Promise<string> => {
  const db = serverPluginApi.getDangerousRootPluginDb(pluginName);
  const { rows } = await db.query(
    "select name from app_public.organizations where id = $1",
    [organizationId],
  );
  return rows[0]?.name ?? "";
};

export const revokeLink = async (
  serverPluginApi: ServerPluginApi,
  { id, pluginId }: { id: string; pluginId: string },
) => {
  const db = serverPluginApi.getDangerousRootPluginDb(pluginName);
  // Scoped by pluginId so a caller can only revoke links on their own scene.
  await db.query(
    `update upload_link set is_active = false, updated_at = now()
     where id = $1 and plugin_id = $2`,
    [id, pluginId],
  );
};

export const listConnectionsForLink = async (
  serverPluginApi: ServerPluginApi,
  uploadLinkId: string,
) => {
  const db = serverPluginApi.getDangerousRootPluginDb(pluginName);
  const { rows } = await db.query(
    `select id, canva_display_name as "displayName"
     from canva_connection
     where created_via_upload_link_id = $1
     order by created_at desc`,
    [uploadLinkId],
  );
  return rows;
};

export const connectionBelongsToLink = async (
  serverPluginApi: ServerPluginApi,
  connectionId: string,
  uploadLinkId: string,
): Promise<boolean> => {
  const db = serverPluginApi.getDangerousRootPluginDb(pluginName);
  const { rows } = await db.query(
    `select 1 from canva_connection
     where id = $1 and created_via_upload_link_id = $2`,
    [connectionId, uploadLinkId],
  );
  return rows.length > 0;
};

/**
 * Forgets the Canva account a visitor connected through this link.
 */
export const forgetLinkConnections = async (
  serverPluginApi: ServerPluginApi,
  uploadLinkId: string,
): Promise<void> => {
  const db = serverPluginApi.getDangerousRootPluginDb(pluginName);
  await db.query(
    `delete from canva_connection where created_via_upload_link_id = $1`,
    [uploadLinkId],
  );
};
