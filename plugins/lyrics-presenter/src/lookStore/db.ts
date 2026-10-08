import { pluginName } from "../consts";
import type { Look } from "../looks";
import type { Api, RequestAuth } from "../songbook/types";

const LOOK_COLUMNS = `key, name, position, template, background`;

/** Server-side, for keeping scenes' copies current */
export const fetchLooks = async (
  api: Api,
  organizationId: string,
): Promise<Look[]> => {
  const db = api.getDangerousRootPluginDb(pluginName);
  const { rows } = await db.query<Look>(
    `select ${LOOK_COLUMNS}
       from look
      where organization_id = $1
      order by position, created_at`,
    [organizationId],
  );
  return rows;
};

export const upsertLook = async (
  api: Api,
  auth: RequestAuth,
  organizationId: string,
  look: Look,
): Promise<void> => {
  const db = api.getPluginDb(pluginName, auth);
  await db.query(
    `insert into look
       (organization_id, key, name, position, template, background)
     values ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
     on conflict (organization_id, key) do update set
       name       = excluded.name,
       position   = excluded.position,
       template   = excluded.template,
       background = excluded.background`,
    [
      organizationId,
      look.key,
      look.name,
      look.position,
      JSON.stringify(look.template),
      look.background === null ? null : JSON.stringify(look.background),
    ],
  );
};

/** For a built-in, back to its default */
export const deleteLook = async (
  api: Api,
  auth: RequestAuth,
  organizationId: string,
  key: string,
): Promise<void> => {
  const db = api.getPluginDb(pluginName, auth);
  await db.query(`delete from look where organization_id = $1 and key = $2`, [
    organizationId,
    key,
  ]);
};
