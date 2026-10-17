import { IntegrationMode, ServerPluginApi } from "@repo/base-plugin/server";

import { getCanvaOAuthConfig } from "./oauth";
import type { CanvaConnectionSummary } from "./tokenStore";

/**
 * Decides how Canva runs for an organization.
 *
 * - `local`: this server has the client secret and stores connections (cloud).
 * - `remote`: it does not, but the org is linked to a cloud that does
 *   (Studio). Signing in happens on the cloud in the system browser; the
 *   design list and the import run here with access tokens from the cloud.
 * - `unavailable`: none of the above.
 */

export const CANVA_PROVIDER = "slides/canva";

/** Paths on the cloud that a local install calls. Served by ./routes.ts */
export const REMOTE_PATHS = {
  status: "/plugin/slides/canva/remote/status",
  begin: "/plugin/slides/canva/remote/begin",
  intent: "/plugin/slides/canva/remote/intent",
  token: "/plugin/slides/canva/remote/token",
  disconnect: "/plugin/slides/canva/remote/disconnect",
};

/** A sign-in started from a local install: connect an account, or import once. */
export type CanvaSignInMode = "connect" | "once";

/** What a sign-in started from a local install hands back. */
export type CanvaSignInResult = { connectionId: string } | { grantId: string };

/** A connected account, as the account chooser lists it. */
export type CanvaConnectionOption = {
  id: string;
  label: string;
  canvaDisplayName: string | null;
  connectedByName: string | null;
};

export const toConnectionOption = (
  c: CanvaConnectionSummary,
): CanvaConnectionOption => ({
  id: c.id,
  label:
    c.canvaDisplayName ??
    (c.connectedByName ? `Added by ${c.connectedByName}` : "Canva account"),
  canvaDisplayName: c.canvaDisplayName,
  connectedByName: c.connectedByName,
});

export const resolveCanvaMode = (
  serverPluginApi: ServerPluginApi,
  organizationId: string,
): Promise<IntegrationMode> =>
  serverPluginApi.integrations.resolveMode({
    hasLocalCredentials: getCanvaOAuthConfig() !== null,
    organizationId,
  });
