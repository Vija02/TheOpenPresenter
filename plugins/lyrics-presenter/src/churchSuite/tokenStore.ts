import { logger } from "@repo/observability";

import { pluginName } from "../consts";
import { Api, RequestAuth } from "../songbook/types";
import { CsTokenResponse, requestAccessToken } from "./client";

export type CsConnectionSummary = {
  id: string;
  accountName: string | null;
  accountSubdomain: string | null;
  connectedByName: string | null;
  createdAt: string;
};

const EXPIRY_LEEWAY_MS = 60_000;

export class CsNotConnectedError extends Error {
  constructor() {
    super("ChurchSuite is not connected to this organization.");
    this.name = "CsNotConnectedError";
  }
}

export const getConnection = async (
  api: Api,
  auth: RequestAuth,
  organizationId: string,
): Promise<CsConnectionSummary | null> => {
  const db = api.getPluginDb(pluginName, auth);
  const { rows } = await db.query<CsConnectionSummary>(
    `select c.id,
            c.account_name as "accountName",
            c.account_subdomain as "accountSubdomain",
            u.name as "connectedByName",
            c.created_at as "createdAt"
       from churchsuite_connection c
       left join app_public.users u on u.id = c.connected_by_user_id
      where c.organization_id = $1`,
    [organizationId],
  );
  return rows[0] ?? null;
};

export const saveConnection = async (
  api: Api,
  {
    organizationId,
    userId,
    clientId,
    clientSecret,
    token,
    accountName,
    accountSubdomain,
  }: {
    organizationId: string;
    userId: string | null;
    clientId: string;
    clientSecret: string;
    token: CsTokenResponse;
    accountName: string | null;
    accountSubdomain: string | null;
  },
): Promise<void> => {
  const db = api.getDangerousRootPluginDb(pluginName);

  await db.withTransaction(async (client) => {
    const {
      rows: [row],
    } = await client.query<{ id: string }>(
      `insert into churchsuite_connection
          (organization_id, connected_by_user_id, account_name, account_subdomain)
        values ($1, $2, $3, $4)
        on conflict (organization_id) do update set
          connected_by_user_id = excluded.connected_by_user_id,
          account_name = excluded.account_name,
          account_subdomain = excluded.account_subdomain
        returning id`,
      [organizationId, userId, accountName, accountSubdomain],
    );

    await client.query(
      `insert into churchsuite_connection_secret
          (churchsuite_connection_id, client_id, client_secret,
           access_token, access_token_expires_at)
        values ($1, $2, $3, $4, now() + ($5 || ' seconds')::interval)
        on conflict (churchsuite_connection_id) do update set
          client_id = excluded.client_id,
          client_secret = excluded.client_secret,
          access_token = excluded.access_token,
          access_token_expires_at = excluded.access_token_expires_at`,
      [
        row!.id,
        clientId,
        clientSecret,
        token.access_token,
        String(token.expires_in),
      ],
    );
  });
};

/** Forgets the organization's connection. Its credentials cascade via FK. */
export const deleteConnection = async (
  api: Api,
  organizationId: string,
): Promise<void> => {
  const db = api.getDangerousRootPluginDb(pluginName);
  await db.query(
    `delete from churchsuite_connection where organization_id = $1`,
    [organizationId],
  );
};

/**
 * Returns a usable access token, minting a new one from the stored client
 * credentials when the cached token is missing, expiring, or was refused.
 */
export const getAccessToken = async (
  api: Api,
  organizationId: string,
  { forceRefresh = false }: { forceRefresh?: boolean } = {},
): Promise<string> => {
  const db = api.getDangerousRootPluginDb(pluginName);

  return db.withTransaction(async (client) => {
    // Row lock so concurrent requests mint one token, not one each
    const {
      rows: [row],
    } = await client.query<{
      id: string;
      clientId: string;
      clientSecret: string;
      accessToken: string | null;
      isExpiring: boolean;
    }>(
      `select s.churchsuite_connection_id as id,
              s.client_id as "clientId",
              s.client_secret as "clientSecret",
              s.access_token as "accessToken",
              (s.access_token_expires_at is null or
               s.access_token_expires_at <= now() + ($2 || ' milliseconds')::interval)
                as "isExpiring"
         from churchsuite_connection_secret s
         join churchsuite_connection c on c.id = s.churchsuite_connection_id
        where c.organization_id = $1
          for update of s`,
      [organizationId, String(EXPIRY_LEEWAY_MS)],
    );

    if (!row) throw new CsNotConnectedError();

    if (row.accessToken && !row.isExpiring && !forceRefresh) {
      return row.accessToken;
    }

    let token: CsTokenResponse;
    try {
      token = await requestAccessToken({
        clientId: row.clientId,
        clientSecret: row.clientSecret,
      });
    } catch (err) {
      // Kept, not deleted: a disabled secret can be re-enabled in ChurchSuite
      logger.error(
        { err, organizationId, scope: "churchSuiteToken" },
        "getAccessToken: could not mint a ChurchSuite access token",
      );
      throw err;
    }

    await client.query(
      `update churchsuite_connection_secret
          set access_token = $2,
              access_token_expires_at = now() + ($3 || ' seconds')::interval
        where churchsuite_connection_id = $1`,
      [row.id, token.access_token, String(token.expires_in)],
    );

    return token.access_token;
  });
};
