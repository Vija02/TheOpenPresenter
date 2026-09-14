import { pluginName } from "../consts";
import { Api, RequestAuth } from "../songbook/types";

/**
 * Setlist sources an organization has switched on.
 * Planning Center is not stored here: connecting an account is what enables it
 */
export const SETLIST_SOURCES = ["myworshiplist"] as const;
export type SetlistSource = (typeof SETLIST_SOURCES)[number];

export const listEnabledSources = async (
  api: Api,
  auth: RequestAuth,
  organizationId: string,
): Promise<SetlistSource[]> => {
  const db = api.getPluginDb(pluginName, auth);
  const { rows } = await db.query<{ source: string }>(
    `select source
       from setlist_source
      where organization_id = $1 and enabled`,
    [organizationId],
  );

  return rows
    .map((row) => row.source)
    .filter((source): source is SetlistSource =>
      SETLIST_SOURCES.includes(source as SetlistSource),
    );
};

export const setSourceEnabled = async (
  api: Api,
  auth: RequestAuth,
  {
    organizationId,
    userId,
    source,
    enabled,
  }: {
    organizationId: string;
    userId: string | null;
    source: SetlistSource;
    enabled: boolean;
  },
): Promise<void> => {
  const db = api.getPluginDb(pluginName, auth);
  await db.query(
    `insert into setlist_source
       (organization_id, source, enabled, enabled_by_user_id)
     values ($1, $2, $3, $4)
     on conflict (organization_id, source) do update set
       enabled = excluded.enabled,
       enabled_by_user_id = excluded.enabled_by_user_id,
       updated_at = now()`,
    [organizationId, source, enabled, userId],
  );
};
