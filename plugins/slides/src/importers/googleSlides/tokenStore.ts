import { ServerPluginApi } from "@repo/base-plugin/server";
import { logger } from "@repo/observability";

import { pluginName } from "../../consts";
import {
  GoogleAccountIdentity,
  GoogleAuthRevokedError,
  GoogleTokenResponse,
  getGoogleOAuthConfig,
  refreshAccessToken,
  revokeToken,
} from "./oauth";

/** Server-side Google connection storage. Only used where the secret lives. */

export type GoogleConnectionSummary = {
  id: string;
  organizationId: string;
  googleEmail: string | null;
  googleDisplayName: string | null;
  connectedByUserId: string | null;
};

export type GoogleAccessToken = {
  accessToken: string;
  /** Epoch ms */
  expiresAt: number;
};

/** Refresh slightly early so a token cannot expire mid request. */
const EXPIRY_LEEWAY_MS = 60_000;

export type GooglePendingAuth = {
  codeVerifier: string;
  organizationId: string;
  userId: string;
  intentId: string | null;
};

export const savePendingAuth = async (
  serverPluginApi: ServerPluginApi,
  stateId: string,
  { codeVerifier, organizationId, userId, intentId }: GooglePendingAuth,
): Promise<void> => {
  const db = serverPluginApi.getDangerousRootPluginDb(pluginName);
  await db.query(
    `insert into google_oauth_state
        (state_id, code_verifier, organization_id, user_id, intent_id)
      values ($1, $2, $3, $4, $5)`,
    [stateId, codeVerifier, organizationId, userId, intentId],
  );
};

/** Atomically consumes the pending authorization for `stateId`. */
export const consumePendingAuth = async (
  serverPluginApi: ServerPluginApi,
  stateId: string,
): Promise<GooglePendingAuth | null> => {
  const db = serverPluginApi.getDangerousRootPluginDb(pluginName);
  const { rows } = await db.query<GooglePendingAuth>(
    `delete from google_oauth_state
      where state_id = $1 and expires_at > now()
      returning code_verifier as "codeVerifier",
                organization_id as "organizationId",
                user_id as "userId",
                intent_id as "intentId"`,
    [stateId],
  );

  // Opportunistic cleanup of abandoned authorization attempts
  db.query(`delete from google_oauth_state where expires_at <= now()`).catch(
    (err: unknown) => {
      logger.warn({ err }, "Failed to sweep expired Google OAuth state");
    },
  );

  return rows[0] ?? null;
};

const summaryColumns = `
  id,
  organization_id as "organizationId",
  google_email as "googleEmail",
  google_display_name as "googleDisplayName",
  connected_by_user_id as "connectedByUserId"`;

/**
 * The account a user picks from. A Drive is personal, so members only use
 * accounts they connected themselves rather than browsing a colleague's.
 */
export const findConnectionForUser = async (
  serverPluginApi: ServerPluginApi,
  organizationId: string,
  userId: string,
): Promise<GoogleConnectionSummary | null> => {
  const db = serverPluginApi.getDangerousRootPluginDb(pluginName);
  const { rows } = await db.query<GoogleConnectionSummary>(
    `select ${summaryColumns}
       from google_connection
      where organization_id = $1 and connected_by_user_id = $2
      order by updated_at desc
      limit 1`,
    [organizationId, userId],
  );
  return rows[0] ?? null;
};

/** Every account a user connected in the org, most recently used first. */
export const listConnectionsForUser = async (
  serverPluginApi: ServerPluginApi,
  organizationId: string,
  userId: string,
): Promise<GoogleConnectionSummary[]> => {
  const db = serverPluginApi.getDangerousRootPluginDb(pluginName);
  const { rows } = await db.query<GoogleConnectionSummary>(
    `select ${summaryColumns}
       from google_connection
      where organization_id = $1 and connected_by_user_id = $2
      order by updated_at desc`,
    [organizationId, userId],
  );
  return rows;
};

export const getConnectionInOrg = async (
  serverPluginApi: ServerPluginApi,
  connectionId: string,
  organizationId: string,
): Promise<GoogleConnectionSummary | null> => {
  const db = serverPluginApi.getDangerousRootPluginDb(pluginName);
  const { rows } = await db.query<GoogleConnectionSummary>(
    `select ${summaryColumns}
       from google_connection
      where id = $1 and organization_id = $2`,
    [connectionId, organizationId],
  );
  return rows[0] ?? null;
};

export const saveConnection = async (
  serverPluginApi: ServerPluginApi,
  {
    organizationId,
    userId,
    token,
    identity,
  }: {
    organizationId: string;
    userId: string;
    token: GoogleTokenResponse;
    identity: GoogleAccountIdentity;
  },
): Promise<string> => {
  const db = serverPluginApi.getDangerousRootPluginDb(pluginName);

  return db.withTransaction(async (client) => {
    const {
      rows: [row],
    } = await client.query<{ id: string }>(
      `insert into google_connection
          (organization_id, connected_by_user_id, google_user_id, google_email,
           google_display_name, scopes)
        values ($1, $2, $3, $4, $5, $6)
        on conflict (organization_id, google_user_id) do update set
          connected_by_user_id = excluded.connected_by_user_id,
          google_email = coalesce(excluded.google_email, google_connection.google_email),
          google_display_name =
            coalesce(excluded.google_display_name, google_connection.google_display_name),
          scopes = excluded.scopes,
          -- Bump so the reconnected account becomes the user's current one
          updated_at = now()
        returning id`,
      [
        organizationId,
        userId,
        identity.googleUserId,
        identity.email,
        identity.displayName,
        token.scope ?? "",
      ],
    );

    // Google omits the refresh token when it considers consent already given.
    // Keep the one we have rather than failing the reconnect.
    const { rowCount } = await client.query(
      `insert into google_connection_secret
          (google_connection_id, access_token, refresh_token, access_token_expires_at)
        select $1, $2, coalesce($3, s.refresh_token), now() + ($4 || ' seconds')::interval
          from (select 1) one
          left join google_connection_secret s on s.google_connection_id = $1
         where coalesce($3, s.refresh_token) is not null
        on conflict (google_connection_id) do update set
          access_token = excluded.access_token,
          refresh_token = excluded.refresh_token,
          access_token_expires_at = excluded.access_token_expires_at`,
      [
        row!.id,
        token.access_token,
        token.refresh_token ?? null,
        String(token.expires_in),
      ],
    );
    if (!rowCount) {
      throw new Error(
        "Google did not grant offline access. Remove TheOpenPresenter from " +
          "your Google account's third-party access and connect again.",
      );
    }

    return row!.id;
  });
};

/**
 * Removes a connection and, best effort, revokes its grant with Google.
 * Revoking ends the grant for every connection of that Google account, so it
 * is skipped while the account is still connected elsewhere.
 */
export const deleteConnection = async (
  serverPluginApi: ServerPluginApi,
  connectionId: string,
): Promise<void> => {
  const db = serverPluginApi.getDangerousRootPluginDb(pluginName);
  const { rows } = await db.query<{
    refreshToken: string | null;
    isUsedElsewhere: boolean;
  }>(
    `select s.refresh_token as "refreshToken",
            exists (
              select 1 from google_connection other
               where other.google_user_id = c.google_user_id
                 and other.id <> c.id
            ) as "isUsedElsewhere"
       from google_connection c
       left join google_connection_secret s on s.google_connection_id = c.id
      where c.id = $1`,
    [connectionId],
  );
  await db.query(`delete from google_connection where id = $1`, [connectionId]);

  const refreshToken = rows[0]?.refreshToken;
  if (refreshToken && !rows[0]?.isUsedElsewhere) {
    revokeToken(refreshToken).catch((err: unknown) => {
      logger.warn({ err, connectionId }, "Failed to revoke Google token");
    });
  }
};

/**
 * A usable access token for one connection, refreshed first if it is at or
 * near expiry. Serialized per connection with a row lock so concurrent imports
 * refresh once.
 */
export const getValidAccessToken = async (
  serverPluginApi: ServerPluginApi,
  connectionId: string,
): Promise<GoogleAccessToken> => {
  const config = getGoogleOAuthConfig();
  if (!config) {
    throw new Error("Google Slides is not configured on this server.");
  }

  const db = serverPluginApi.getDangerousRootPluginDb(pluginName);
  const log = logger.child({ connectionId, scope: "googleToken" });

  // Set when Google tells us the grant is permanently dead
  let grantIsDead = false;

  try {
    return await db.withTransaction(async (client) => {
      const {
        rows: [row],
      } = await client.query<{
        accessToken: string;
        refreshToken: string;
        expiresAt: Date;
        isExpiring: boolean;
      }>(
        `select access_token as "accessToken",
                refresh_token as "refreshToken",
                access_token_expires_at as "expiresAt",
                (access_token_expires_at <= now() + ($2 || ' milliseconds')::interval)
                  as "isExpiring"
           from google_connection_secret
          where google_connection_id = $1
          for update`,
        [connectionId, String(EXPIRY_LEEWAY_MS)],
      );

      if (!row) {
        throw new GoogleAuthRevokedError(
          "This Google account is no longer connected.",
        );
      }

      if (!row.isExpiring) {
        return {
          accessToken: row.accessToken,
          expiresAt: new Date(row.expiresAt).getTime(),
        };
      }

      let refreshed: GoogleTokenResponse;
      try {
        refreshed = await refreshAccessToken({
          config,
          refreshToken: row.refreshToken,
        });
      } catch (err) {
        if (err instanceof GoogleAuthRevokedError) {
          grantIsDead = true;
          log.warn({ err }, "Refresh token rejected, clearing connection");
          throw new GoogleAuthRevokedError(
            "Access to this Google account was removed. Connect it again.",
          );
        }
        log.error({ err }, "Refresh failed");
        throw err;
      }

      const {
        rows: [updated],
      } = await client.query<{ expiresAt: Date }>(
        `update google_connection_secret
            set access_token = $2,
                refresh_token = coalesce($3, refresh_token),
                access_token_expires_at = now() + ($4 || ' seconds')::interval
          where google_connection_id = $1
          returning access_token_expires_at as "expiresAt"`,
        [
          connectionId,
          refreshed.access_token,
          refreshed.refresh_token ?? null,
          String(refreshed.expires_in),
        ],
      );

      log.debug({ expiresIn: refreshed.expires_in }, "Access token refreshed");
      return {
        accessToken: refreshed.access_token,
        expiresAt: new Date(updated!.expiresAt).getTime(),
      };
    });
  } finally {
    if (grantIsDead) {
      const db = serverPluginApi.getDangerousRootPluginDb(pluginName);
      await db
        .query(`delete from google_connection where id = $1`, [connectionId])
        .catch((err: unknown) => {
          log.error({ err }, "Failed to clear revoked Google connection");
        });
    }
  }
};
