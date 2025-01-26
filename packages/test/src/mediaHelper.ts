import { PoolClient } from "pg";
import { toUUID, typeidUnboxed } from "typeid-js";

export const createMedia = async (client: PoolClient, orgId: string) => {
  const mediaId = typeidUnboxed("media");
  const mediaName = mediaId + ".png";
  const uuid = toUUID(mediaId);

  await client.query(
    `INSERT INTO app_public.medias (id, media_name, file_offset, organization_id) values ($1, $2, $3, $4)`,
    [uuid, mediaName, 0, orgId],
  );

  return { uuid, mediaId, mediaName };
};

export const createMediaDependency = async (
  client: PoolClient,
  parentUuid: string,
  childUuid: string,
) => {
  return await client.query(
    `INSERT INTO app_public.media_dependencies (parent_media_id, child_media_id) values ($1, $2)`,
    [parentUuid, childUuid],
  );
};
