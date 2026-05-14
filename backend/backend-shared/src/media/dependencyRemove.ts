import { TypeId, toUUID } from "typeid-js";

import { WithPgClient } from "../types";

export const getFileIdsToDeleteFromID = async (
  withPgClient: WithPgClient,
  id: string,
) => {
  const splittedKey = id.split(".");
  const mediaId = splittedKey[0];
  const uuid = toUUID(mediaId as TypeId<string>);

  const rowsToDelete = await withPgClient(async (client) => {
    const { rows: childRows } = await client.query(
      `
        WITH RECURSIVE child_tree AS (
          -- Base case: direct children
          SELECT child_media_id
          FROM app_public.media_dependencies
          WHERE parent_media_id = $1

          UNION

          -- Recursive case: children of children
          SELECT md.child_media_id
          FROM app_public.media_dependencies md
          JOIN child_tree ct ON md.parent_media_id = ct.child_media_id
        )
        SELECT * FROM child_tree;
      `,
      [uuid],
    );

    const allUuidToDelete = Array.from(
      new Set(childRows.map((row) => row.child_media_id).concat([uuid])),
    );

    const { rows } = await client.query(
      `
        SELECT media_name
          FROM app_public.medias
          WHERE id = ANY($1::uuid[]);
      `,
      [allUuidToDelete],
    );

    return rows;
  });

  return rowsToDelete.map((x) => x.media_name);
};
