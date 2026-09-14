import { logger } from "@repo/observability";

import { pluginName } from "../consts";
import { Api, RequestAuth } from "../songbook/types";
import {
  PcoAuthRevokedError,
  PcoTokenResponse,
  getPcoOAuthConfig,
  refreshAccessToken,
} from "./oauth";

export type PcoConnectionSummary = {
  id: string;
  organizationId: string;
  pcoOrganizationId: string;
  pcoOrganizationName: string | null;
  pcoPersonId: string;
  pcoPersonName: string | null;
  connectedByUserId: string | null;
  connectedByName: string | null;
  scopes: string;
  createdAt: string;
};

const EXPIRY_LEEWAY_MS = 60_000;

export const getUserIdForSession = async (
  api: Api,
  sessionId: string | null | undefined,
): Promise<string | null> => {
  if (!sessionId) return null;
  const db = api.getDangerousRootPluginDb(pluginName);
  const { rows } = await db.query<{ userId: string }>(
    `select user_id as "userId" from app_private.sessions where uuid = $1`,
    [sessionId],
  );
  return rows[0]?.userId ?? null;
};

export type PcoPendingAuth = {
  codeVerifier: string;
  organizationId: string;
  userId: string;
};

export const savePendingAuth = async (
  api: Api,
  stateId: string,
  { codeVerifier, organizationId, userId }: PcoPendingAuth,
): Promise<void> => {
  const db = api.getDangerousRootPluginDb(pluginName);
  await db.query(
    `insert into pco_oauth_state
        (state_id, code_verifier, organization_id, user_id)
      values ($1, $2, $3, $4)`,
    [stateId, codeVerifier, organizationId, userId],
  );
};

export const consumePendingAuth = async (
  api: Api,
  stateId: string,
): Promise<PcoPendingAuth | null> => {
  const db = api.getDangerousRootPluginDb(pluginName);
  const { rows } = await db.query<PcoPendingAuth>(
    `delete from pco_oauth_state
      where state_id = $1 and expires_at > now()
      returning code_verifier as "codeVerifier",
                organization_id as "organizationId",
                user_id as "userId"`,
    [stateId],
  );

  // Opportunistic cleanup of abandoned authorization attempts
  db.query(`delete from pco_oauth_state where expires_at <= now()`).catch(
    (err: unknown) => {
      logger.warn(
        { err },
        "lyrics-presenter: failed to sweep expired Planning Center OAuth state",
      );
    },
  );

  return rows[0] ?? null;
};

export const isOrganizationMember = async (
  api: Api,
  auth: RequestAuth,
  organizationId: string,
  userId: string,
): Promise<boolean> => {
  const db = api.getPluginDb(pluginName, auth);
  const { rows } = await db.query(
    `select 1
       from app_public.organization_memberships
      where organization_id = $1 and user_id = $2
      limit 1`,
    [organizationId, userId],
  );
  return rows.length > 0;
};

export const isOrganizationMemberAsRoot = async (
  api: Api,
  organizationId: string,
  userId: string,
): Promise<boolean> => {
  const db = api.getDangerousRootPluginDb(pluginName);
  const { rows } = await db.query(
    `select 1
       from app_public.organization_memberships
      where organization_id = $1 and user_id = $2
      limit 1`,
    [organizationId, userId],
  );
  return rows.length > 0;
};

export const listConnections = async (
  api: Api,
  auth: RequestAuth,
  organizationId: string,
): Promise<PcoConnectionSummary[]> => {
  const db = api.getPluginDb(pluginName, auth);
  const { rows } = await db.query(
    `select c.id,
            c.organization_id as "organizationId",
            c.pco_organization_id as "pcoOrganizationId",
            c.pco_organization_name as "pcoOrganizationName",
            c.pco_person_id as "pcoPersonId",
            c.pco_person_name as "pcoPersonName",
            c.connected_by_user_id as "connectedByUserId",
            u.name as "connectedByName",
            c.scopes,
            c.created_at as "createdAt"
       from pco_connection c
       left join app_public.users u on u.id = c.connected_by_user_id
      where c.organization_id = $1
      order by c.created_at asc`,
    [organizationId],
  );

  return rows as PcoConnectionSummary[];
};

export const assertConnectionInOrg = async (
  api: Api,
  connectionId: string,
  organizationId: string,
): Promise<void> => {
  const db = api.getDangerousRootPluginDb(pluginName);
  const { rows } = await db.query(
    `select 1 from pco_connection where id = $1 and organization_id = $2`,
    [connectionId, organizationId],
  );
  if (rows.length === 0) {
    throw new Error(
      "That Planning Center account is not connected to this organization.",
    );
  }
};

export const saveConnection = async (
  api: Api,
  {
    organizationId,
    userId,
    token,
    pcoOrganizationId,
    pcoOrganizationName,
    pcoPersonId,
    pcoPersonName,
  }: {
    organizationId: string;
    userId: string | null;
    token: PcoTokenResponse;
    pcoOrganizationId: string;
    pcoOrganizationName?: string | null;
    pcoPersonId: string;
    pcoPersonName?: string | null;
  },
): Promise<string> => {
  const db = api.getDangerousRootPluginDb(pluginName);

  return db.withTransaction(async (client) => {
    const {
      rows: [row],
    } = await client.query<{ id: string }>(
      `insert into pco_connection
          (organization_id, connected_by_user_id, pco_organization_id,
           pco_organization_name, pco_person_id, pco_person_name, scopes)
        values ($1, $2, $3, $4, $5, $6, $7)
        on conflict (organization_id, pco_organization_id, pco_person_id)
        do update set
          connected_by_user_id = excluded.connected_by_user_id,
          -- Keep the previous label if this authorization could not read one
          pco_organization_name =
            coalesce(excluded.pco_organization_name, pco_connection.pco_organization_name),
          pco_person_name =
            coalesce(excluded.pco_person_name, pco_connection.pco_person_name),
          scopes = excluded.scopes
        returning id`,
      [
        organizationId,
        userId,
        pcoOrganizationId,
        pcoOrganizationName ?? null,
        pcoPersonId,
        pcoPersonName ?? null,
        token.scope ?? "",
      ],
    );

    await client.query(
      `insert into pco_connection_secret
          (pco_connection_id, access_token, refresh_token, access_token_expires_at)
        values ($1, $2, $3, now() + ($4 || ' seconds')::interval)
        on conflict (pco_connection_id) do update set
          access_token = excluded.access_token,
          refresh_token = excluded.refresh_token,
          access_token_expires_at = excluded.access_token_expires_at`,
      [
        row!.id,
        token.access_token,
        token.refresh_token,
        String(token.expires_in),
      ],
    );

    return row!.id;
  });
};

/** Removes a single connection. Its tokens cascade via FK. */
export const deleteConnection = async (
  api: Api,
  connectionId: string,
): Promise<void> => {
  const db = api.getDangerousRootPluginDb(pluginName);
  await db.query(`delete from pco_connection where id = $1`, [connectionId]);
};

/** Returns a usable access token for one connection */
export const getValidAccessToken = async (
  api: Api,
  connectionId: string,
): Promise<string> => {
  const config = getPcoOAuthConfig();
  if (!config) {
    throw new Error(
      "Planning Center integration is not configured on this server.",
    );
  }

  const db = api.getDangerousRootPluginDb(pluginName);

  // Set when Planning Center tells us the grant is permanently dead
  let grantIsDead = false;

  try {
    return await db.withTransaction(async (client) => {
      const {
        rows: [row],
      } = await client.query<{
        id: string;
        accessToken: string;
        refreshToken: string;
        isExpiring: boolean;
      }>(
        `select s.pco_connection_id as id,
                s.access_token as "accessToken",
                s.refresh_token as "refreshToken",
                (s.access_token_expires_at <= now() + ($2 || ' milliseconds')::interval)
                  as "isExpiring"
           from pco_connection_secret s
          where s.pco_connection_id = $1
          for update of s`,
        [connectionId, String(EXPIRY_LEEWAY_MS)],
      );

      if (!row) {
        logger.warn(
          { connectionId, scope: "pcoToken" },
          "getValidAccessToken: no tokens stored for this connection",
        );
        throw new PcoAuthRevokedError(
          "This Planning Center account is no longer connected.",
        );
      }

      if (!row.isExpiring) return row.accessToken;

      let refreshed: PcoTokenResponse;
      try {
        refreshed = await refreshAccessToken({
          config,
          refreshToken: row.refreshToken,
        });
      } catch (err) {
        if (err instanceof PcoAuthRevokedError) {
          grantIsDead = true;
          logger.error(
            { connectionId, scope: "pcoToken" },
            "getValidAccessToken: refresh token rejected, clearing connection",
          );
        } else {
          logger.error(
            { err, connectionId, scope: "pcoToken" },
            "getValidAccessToken: refresh failed",
          );
        }
        throw err;
      }

      await client.query(
        `update pco_connection_secret
            set access_token = $2,
                refresh_token = $3,
                access_token_expires_at = now() + ($4 || ' seconds')::interval
          where pco_connection_id = $1`,
        [
          row.id,
          refreshed.access_token,
          refreshed.refresh_token,
          String(refreshed.expires_in),
        ],
      );

      if (refreshed.scope) {
        await client.query(
          `update pco_connection set scopes = $2 where id = $1`,
          [row.id, refreshed.scope],
        );
      }

      return refreshed.access_token;
    });
  } finally {
    if (grantIsDead) {
      // Drop only the dead connection, so other Planning Center accounts
      // linked to the same organization keep working.
      await deleteConnection(api, connectionId).catch((deleteErr: unknown) => {
        logger.error(
          { err: deleteErr, connectionId },
          "lyrics-presenter: failed to clear revoked Planning Center connection",
        );
      });
    }
  }
};
