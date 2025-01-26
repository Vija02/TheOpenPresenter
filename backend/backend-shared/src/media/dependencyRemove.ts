import { Express } from "express";
import { Pool } from "pg";
import { TypeId, toUUID } from "typeid-js";

export const getFileIdsToDeleteFromID = async (app: Express, id: string) => {
  const rootPgPool = app.get("rootPgPool") as Pool;

  const splittedKey = id.split(".");
  const mediaId = splittedKey[0];
  const uuid = toUUID(mediaId as TypeId<string>);

  const { rows } = await rootPgPool.query(
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
    new Set(rows.map((row) => row.child_media_id).concat([uuid])),
  );

  const { rows: rowsToDelete } = await rootPgPool.query(
    `
      SELECT media_name 
        FROM app_public.medias 
        WHERE id = ANY($1::uuid[]);  
    `,
    [allUuidToDelete],
  );

  return rowsToDelete.map((x) => x.media_name);
};
