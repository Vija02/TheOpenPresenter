import {
  CloudConnectionInfo,
  IntegrationMode,
  ServerPluginApi,
} from "@repo/base-plugin/server";

import { getGoogleOAuthConfig } from "./oauth";
import {
  GoogleAccessToken,
  GoogleConnectionSummary,
  getValidAccessToken,
} from "./tokenStore";

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
  status: "/plugin/slides/google/remote/status",
  pick: "/plugin/slides/google/remote/pick",
  intent: "/plugin/slides/google/remote/intent",
  token: "/plugin/slides/google/remote/token",
  disconnect: "/plugin/slides/google/remote/disconnect",
};

/**
 * What a remote pick starts with:
 * - "pick": the picker, with `connectionId` or the latest account
 * - "connect": sign in and connect an account, then the picker
 * - "once": sign in for this import only; nothing is stored
 */
export type RemotePickMode = "pick" | "connect" | "once";

export type RemotePickInput = {
  mode: RemotePickMode;
  connectionId?: string | null;
  fileIds?: string[] | null;
};

export { MAX_PICK_FILE_IDS } from "../../consts";

/** A connected account, as the account chooser lists it. */
export type GoogleAccountOption = {
  id: string;
  label: string;
  displayName: string | null;
};

export const toAccountOption = (
  connection: GoogleConnectionSummary,
): GoogleAccountOption => ({
  id: connection.id,
  label:
    connection.googleEmail ?? connection.googleDisplayName ?? "Google account",
  // Only worth showing when it differs from the email
  displayName:
    connection.googleEmail && connection.googleDisplayName
      ? connection.googleDisplayName
      : null,
});

export type GoogleMode = IntegrationMode;

/**
 * What a remote pick hands back: the stored connection it used, or for
 * "Import once" a short-lived access token in its place.
 */
export type GooglePickResult = {
  presentationId: string;
  name: string | null;
  connectionId: string | null;
  accessToken?: string;
  fileIds?: string[];
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
  input: RemotePickInput,
) =>
  serverPluginApi.integrations.callCloud<{ intentId: string; url: string }>(
    await requireRemote(serverPluginApi, organizationId),
    REMOTE_PATHS.pick,
    { method: "POST", body: input },
  );

/** Remote: the caller's own accounts, as connected on the cloud. */
export const getRemoteAccounts = async (
  serverPluginApi: ServerPluginApi,
  organizationId: string,
) =>
  serverPluginApi.integrations.callCloud<{ accounts: GoogleAccountOption[] }>(
    await requireRemote(serverPluginApi, organizationId),
    REMOTE_PATHS.status,
  );

/** Remote: disconnects one of the caller's accounts on the cloud. */
export const disconnectRemote = async (
  serverPluginApi: ServerPluginApi,
  organizationId: string,
  connectionId: string,
) =>
  serverPluginApi.integrations.callCloud<{ ok: true }>(
    await requireRemote(serverPluginApi, organizationId),
    REMOTE_PATHS.disconnect,
    { method: "POST", body: { connectionId } },
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
