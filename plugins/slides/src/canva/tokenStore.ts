import { ServerPluginApi } from "@repo/base-plugin/server";
import { logger } from "@repo/observability";

import { pluginName } from "../consts";
import {
  CanvaAuthRevokedError,
  CanvaTokenResponse,
  getCanvaOAuthConfig,
  refreshAccessToken,
} from "./oauth";

export type RequestAuth = {
  sessionId: string | null;
  screenGuestSessionId: string | null;
};

export type CanvaConnectionSummary = {
  id: string;
  organizationId: string;
  canvaUserId: string;
  canvaTeamId: string | null;
  canvaDisplayName: string | null;
  connectedByUserId: string | null;
  connectedByName: string | null;
  scopes: string;
  createdAt: string;
};

/** Refresh slightly early so a token cannot expire mid request. */
const EXPIRY_LEEWAY_MS = 60_000;

export const getUserIdForSession = async (
  serverPluginApi: ServerPluginApi,
  sessionId: string | null | undefined,
): Promise<string | null> => {
  if (!sessionId) return null;
  const db = serverPluginApi.getDangerousRootPluginDb(pluginName);
  const { rows } = await db.query<{ userId: string }>(
    `select user_id as "userId" from app_private.sessions where uuid = $1`,
    [sessionId],
  );
  return rows[0]?.userId ?? null;
};

export type CanvaPendingAuth = {
  codeVerifier: string;
  organizationId: string;
  userId: string;
};

/**
 * Stashes the PKCE verifier keyed by the OAuth `state` value.
 */
export const savePendingAuth = async (
  serverPluginApi: ServerPluginApi,
  stateId: string,
  { codeVerifier, organizationId, userId }: CanvaPendingAuth,
): Promise<void> => {
  const db = serverPluginApi.getDangerousRootPluginDb(pluginName);
  await db.query(
    `insert into canva_oauth_state
        (state_id, code_verifier, organization_id, user_id)
      values ($1, $2, $3, $4)`,
    [stateId, codeVerifier, organizationId, userId],
  );
};

/**
 * Atomically consumes the pending authorization for `stateId`.
 */
export const consumePendingAuth = async (
  serverPluginApi: ServerPluginApi,
  stateId: string,
): Promise<CanvaPendingAuth | null> => {
  const db = serverPluginApi.getDangerousRootPluginDb(pluginName);
  const { rows } = await db.query<CanvaPendingAuth>(
    `delete from canva_oauth_state
      where state_id = $1 and expires_at > now()
      returning code_verifier as "codeVerifier",
                organization_id as "organizationId",
                user_id as "userId"`,
    [stateId],
  );

  // Opportunistic cleanup of abandoned authorization attempts
  db.query(`delete from canva_oauth_state where expires_at <= now()`).catch(
    (err: unknown) => {
      logger.warn({ err }, "Failed to sweep expired Canva OAuth state");
    },
  );

  return rows[0] ?? null;
};

export const isOrganizationMember = async (
  serverPluginApi: ServerPluginApi,
  auth: RequestAuth,
  organizationId: string,
  userId: string,
): Promise<boolean> => {
  const db = serverPluginApi.getPluginDb(pluginName, auth);
  const { rows } = await db.query(
    `select 1
       from app_public.organization_memberships
      where organization_id = $1 and user_id = $2
      limit 1`,
    [organizationId, userId],
  );
  return rows.length > 0;
};

// Only for the OAuth callback, which arrives without a session cookie
export const isOrganizationMemberAsRoot = async (
  serverPluginApi: ServerPluginApi,
  organizationId: string,
  userId: string,
): Promise<boolean> => {
  const db = serverPluginApi.getDangerousRootPluginDb(pluginName);
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
  serverPluginApi: ServerPluginApi,
  auth: RequestAuth,
  organizationId: string,
): Promise<CanvaConnectionSummary[]> => {
  const db = serverPluginApi.getPluginDb(pluginName, auth);
  const { rows } = await db.query(
    `select c.id,
            c.organization_id as "organizationId",
            c.canva_user_id as "canvaUserId",
            c.canva_team_id as "canvaTeamId",
            c.canva_display_name as "canvaDisplayName",
            c.connected_by_user_id as "connectedByUserId",
            u.name as "connectedByName",
            c.scopes,
            c.created_at as "createdAt"
       from canva_connection c
       left join app_public.users u on u.id = c.connected_by_user_id
      where c.organization_id = $1
      order by c.created_at asc`,
    [organizationId],
  );

  return rows as CanvaConnectionSummary[];
};

export const assertConnectionInOrg = async (
  serverPluginApi: ServerPluginApi,
  connectionId: string,
  organizationId: string,
): Promise<void> => {
  const db = serverPluginApi.getDangerousRootPluginDb(pluginName);
  const { rows } = await db.query(
    `select 1 from canva_connection where id = $1 and organization_id = $2`,
    [connectionId, organizationId],
  );
  if (rows.length === 0) {
    throw new Error(
      "That Canva account is not connected to this organization.",
    );
  }
};

export const saveConnection = async (
  serverPluginApi: ServerPluginApi,
  {
    organizationId,
    userId,
    token,
    canvaUserId,
    canvaTeamId,
    canvaDisplayName,
  }: {
    organizationId: string;
    userId: string | null;
    token: CanvaTokenResponse;
    canvaUserId: string;
    canvaTeamId?: string | null;
    canvaDisplayName?: string | null;
  },
): Promise<string> => {
  const db = serverPluginApi.getDangerousRootPluginDb(pluginName);

  return db.withTransaction(async (client) => {
    const {
      rows: [row],
    } = await client.query<{ id: string }>(
      `insert into canva_connection
          (organization_id, connected_by_user_id, canva_user_id, canva_team_id,
           canva_display_name, scopes)
        values ($1, $2, $3, $4, $5, $6)
        on conflict (organization_id, canva_user_id) do update set
          connected_by_user_id = excluded.connected_by_user_id,
          canva_team_id = excluded.canva_team_id,
          -- Keep the previous label if this authorization could not read one
          canva_display_name =
            coalesce(excluded.canva_display_name, canva_connection.canva_display_name),
          scopes = excluded.scopes
        returning id`,
      [
        organizationId,
        userId,
        canvaUserId,
        canvaTeamId ?? null,
        canvaDisplayName ?? null,
        token.scope ?? "",
      ],
    );

    await client.query(
      `insert into canva_connection_secret
          (canva_connection_id, access_token, refresh_token, access_token_expires_at)
        values ($1, $2, $3, now() + ($4 || ' seconds')::interval)
        on conflict (canva_connection_id) do update set
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
  serverPluginApi: ServerPluginApi,
  connectionId: string,
): Promise<void> => {
  const db = serverPluginApi.getDangerousRootPluginDb(pluginName);
  await db.query(`delete from canva_connection where id = $1`, [connectionId]);
};

/**
 * Returns a usable access token for one connection, refreshing it first if it
 * is at or near expiry.
 *
 * Canva refresh tokens are single use and rotate on every refresh. If two
 * imports using the same connection refreshed concurrently, both would read the
 * same refresh token, one would win, and the loser could overwrite the row with
 * a token Canva had already invalidated, permanently breaking the connection.
 * The whole read/refresh/write therefore happens inside one transaction that
 * takes a row lock, so refreshes serialize per connection. Locking by
 * connection (rather than by organization) also means one account refreshing
 * never blocks another account in the same organization.
 */
export const getValidAccessToken = async (
  serverPluginApi: ServerPluginApi,
  connectionId: string,
): Promise<string> => {
  const config = getCanvaOAuthConfig();
  if (!config) {
    throw new Error("Canva integration is not configured on this server.");
  }

  const db = serverPluginApi.getDangerousRootPluginDb(pluginName);

  // Set when Canva tells us the grant is permanently dead
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
        `select s.canva_connection_id as id,
                s.access_token as "accessToken",
                s.refresh_token as "refreshToken",
                (s.access_token_expires_at <= now() + ($2 || ' milliseconds')::interval)
                  as "isExpiring"
           from canva_connection_secret s
          where s.canva_connection_id = $1
          for update of s`,
        [connectionId, String(EXPIRY_LEEWAY_MS)],
      );

      if (!row) {
        logger.warn(
          { connectionId, scope: "canvaToken" },
          "getValidAccessToken: no tokens stored for this connection",
        );
        throw new CanvaAuthRevokedError(
          "This Canva account is no longer connected.",
        );
      }

      if (!row.isExpiring) {
        logger.info(
          { connectionId, scope: "canvaToken" },
          "getValidAccessToken: reusing cached access token",
        );
        return row.accessToken;
      }

      logger.info(
        { connectionId, scope: "canvaToken" },
        "getValidAccessToken: access token expiring, refreshing now",
      );

      let refreshed: CanvaTokenResponse;
      try {
        refreshed = await refreshAccessToken({
          config,
          refreshToken: row.refreshToken,
        });
      } catch (err) {
        if (err instanceof CanvaAuthRevokedError) {
          grantIsDead = true;
          logger.error(
            { connectionId, scope: "canvaToken" },
            "getValidAccessToken: refresh token rejected, clearing connection",
          );
        } else {
          logger.error(
            { err, connectionId, scope: "canvaToken" },
            "getValidAccessToken: refresh failed",
          );
        }
        throw err;
      }

      await client.query(
        `update canva_connection_secret
            set access_token = $2,
                refresh_token = $3,
                access_token_expires_at = now() + ($4 || ' seconds')::interval
          where canva_connection_id = $1`,
        [
          row.id,
          refreshed.access_token,
          refreshed.refresh_token,
          String(refreshed.expires_in),
        ],
      );

      if (refreshed.scope) {
        await client.query(
          `update canva_connection set scopes = $2 where id = $1`,
          [row.id, refreshed.scope],
        );
      }

      logger.info(
        {
          connectionId,
          scope: "canvaToken",
          expiresIn: refreshed.expires_in,
        },
        "getValidAccessToken: refresh succeeded, token rotated",
      );
      return refreshed.access_token;
    });
  } finally {
    if (grantIsDead) {
      // Drop only the dead connection, so other Canva accounts linked to the
      // same organization keep working.
      await deleteConnection(serverPluginApi, connectionId).catch(
        (deleteErr: unknown) => {
          logger.error(
            { err: deleteErr, connectionId },
            "Failed to clear revoked Canva connection",
          );
        },
      );
    }
  }
};
