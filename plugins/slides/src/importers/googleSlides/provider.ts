import {
  CloudConnectionInfo,
  IntegrationMode,
  ServerPluginApi,
} from "@repo/base-plugin/server";

import { getGoogleOAuthConfig } from "./oauth";
import { GoogleAccessToken, getValidAccessToken } from "./tokenStore";

/**
 * Decides how Google Slides runs for an organization and hides the
 * difference from callers.
 *
 * - `local`: this server has the client secret and stores connections (cloud).
 * - `remote`: it does not, but the org is linked to a cloud that does. Picking
 *   happens on a cloud page in the system browser; access tokens are fetched
 *   from the cloud per import.
 * - `unavailable`: none of the above.
 */

export const GOOGLE_PROVIDER = "slides/google";

/** Paths on the cloud that a local install calls. Served by ./routes.ts */
export const REMOTE_PATHS = {
  pick: "/plugin/slides/google/remote/pick",
  intent: "/plugin/slides/google/remote/intent",
  token: "/plugin/slides/google/remote/token",
};

export type GoogleMode = IntegrationMode;

export type GooglePickResult = {
  presentationId: string;
  name: string | null;
  connectionId: string;
};

export const resolveGoogleMode = async (
  serverPluginApi: ServerPluginApi,
  organizationId: string,
): Promise<GoogleMode> =>
  serverPluginApi.integrations.resolveMode({
    hasLocalCredentials: getGoogleOAuthConfig() !== null,
    organizationId,
  });

const requireRemote = async (
  serverPluginApi: ServerPluginApi,
  organizationId: string,
): Promise<CloudConnectionInfo> => {
  const resolved = await resolveGoogleMode(serverPluginApi, organizationId);
  if (resolved.mode === "remote") return resolved.cloudConnection;
  if (resolved.mode === "unavailable") throw new Error(resolved.reason);
  throw new Error("Google Slides runs on this server, not through the cloud.");
};

/** Remote: starts a pick on the cloud. Open `url` in the system browser. */
export const beginRemotePick = async (
  serverPluginApi: ServerPluginApi,
  organizationId: string,
) =>
  serverPluginApi.integrations.callCloud<{ intentId: string; url: string }>(
    await requireRemote(serverPluginApi, organizationId),
    REMOTE_PATHS.pick,
    { method: "POST", body: {} },
  );

/** Remote: where a pick started by `beginRemotePick` has got to. */
export const getRemotePickStatus = async (
  serverPluginApi: ServerPluginApi,
  organizationId: string,
  intentId: string,
) =>
  serverPluginApi.integrations.callCloud<{
    status: "pending" | "done" | "failed";
    result: GooglePickResult | null;
    error: string | null;
  }>(
    await requireRemote(serverPluginApi, organizationId),
    REMOTE_PATHS.intent,
    { query: { id: intentId } },
  );

/**
 * An access token for a stored connection, wherever it is stored. The only
 * Google credential a local install ever holds, and only in memory.
 */
export const getGoogleAccessToken = async (
  serverPluginApi: ServerPluginApi,
  organizationId: string,
  connectionId: string,
): Promise<GoogleAccessToken> => {
  const resolved = await resolveGoogleMode(serverPluginApi, organizationId);

  if (resolved.mode === "local") {
    return getValidAccessToken(serverPluginApi, connectionId);
  }
  if (resolved.mode === "remote") {
    return serverPluginApi.integrations.callCloud<GoogleAccessToken>(
      resolved.cloudConnection,
      REMOTE_PATHS.token,
      { method: "POST", body: { connectionId } },
    );
  }
  throw new Error(resolved.reason);
};
