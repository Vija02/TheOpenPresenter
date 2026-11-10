import { readSseEvents } from "@repo/lib";

import {
  CloudConnectionInfo,
  IntegrationsApi,
  REMOTE_ORGANIZATION_HEADER,
} from "../integrations";
import { isAIConfigured } from "./config";

/**
 * Where an AI request runs. An organization linked to the cloud always uses
 * the cloud, so a local install needs no key of its own and every install
 * gets the same models. Otherwise this server's own key, if it has one.
 *
 * Forwarded requests go to the same route on the cloud, which runs the work
 * and streams it back; each event is passed through untouched, so callers
 * cannot tell the difference.
 */

export const CONNECT_FOR_AI_REASON =
  "Connect this organization to TheOpenPresenter Cloud to use AI.";
export const AI_SIGN_IN_EXPIRED_REASON =
  "Your TheOpenPresenter Cloud sign-in has expired. Reconnect to the cloud to use AI.";

export class AiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

export type AiPlacement =
  | { mode: "cloud"; connection: CloudConnectionInfo }
  | { mode: "local" }
  | { mode: "unavailable"; reason: string };

type RequestWithSession = Parameters<IntegrationsApi["getRequestUserId"]>[0];

export const placeAiRequest = async (
  integrations: IntegrationsApi,
  req: RequestWithSession,
  organizationId: string | undefined,
): Promise<AiPlacement> => {
  // A link is only used on behalf of the organization's own members.
  const userId = organizationId
    ? await integrations.getRequestUserId(req)
    : null;
  const isMember =
    !!userId &&
    (await integrations.isOrganizationMember(organizationId!, userId));
  const connection = isMember
    ? await integrations.getCloudConnection(organizationId!)
    : null;

  if (connection && !connection.isExpired) {
    const { isExpired: _isExpired, ...cloudConnection } = connection;
    return { mode: "cloud", connection: cloudConnection };
  }
  if (isAIConfigured()) return { mode: "local" };
  return {
    mode: "unavailable",
    reason: connection ? AI_SIGN_IN_EXPIRED_REASON : CONNECT_FOR_AI_REASON,
  };
};

/** POSTs `body` to `path` on the cloud and yields each event it streams. */
export async function* forwardAiToCloud(
  connection: CloudConnectionInfo,
  path: string,
  body: unknown,
  signal: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): AsyncGenerator<unknown, void, unknown> {
  let res: Response;
  try {
    res = await fetchImpl(new URL(path, connection.host), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        "x-top-csrf-protection": "1",
        Cookie: connection.sessionCookie,
        [REMOTE_ORGANIZATION_HEADER]: connection.targetOrganizationSlug,
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (signal.aborted) throw err;
    throw new AiUnavailableError(
      "Couldn't reach TheOpenPresenter Cloud. Check your internet connection.",
    );
  }

  if (res.status === 401 || res.status === 403) {
    throw new AiUnavailableError(AI_SIGN_IN_EXPIRED_REASON);
  }
  if (res.status === 404) {
    throw new AiUnavailableError(
      "TheOpenPresenter Cloud doesn't have this AI feature yet.",
    );
  }
  if (!res.ok || !res.body) {
    throw new AiUnavailableError("AI didn't work this time. Try again.");
  }

  for await (const event of readSseEvents(res.body, { signal })) {
    let payload: unknown;
    try {
      payload = JSON.parse(event.data);
    } catch {
      continue;
    }
    yield payload;
  }
}

/**
 * Runs an AI request wherever it belongs: forwarded to the cloud, or
 * `local()` on this server. `body` is what the cloud receives, without the
 * local organization's id, which means nothing there.
 */
export async function* runAi({
  integrations,
  req,
  organizationId,
  signal,
  cloudPath,
  body,
  local,
}: {
  integrations: IntegrationsApi;
  req: RequestWithSession;
  organizationId: string | undefined;
  signal: AbortSignal;
  cloudPath: string;
  body: unknown;
  local: () => AsyncGenerator<unknown, void, unknown>;
}): AsyncGenerator<unknown, void, unknown> {
  const placement = await placeAiRequest(integrations, req, organizationId);
  if (placement.mode === "unavailable") {
    throw new AiUnavailableError(placement.reason);
  }
  if (placement.mode === "local") {
    yield* local();
    return;
  }
  yield* forwardAiToCloud(placement.connection, cloudPath, body, signal);
}

/** The organization a request is for, as sent by the app, if valid. */
export const organizationIdOf = (raw: unknown): string | undefined => {
  const value = (raw as { organizationId?: unknown } | null)?.organizationId;
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
    ? value
    : undefined;
};

/** `raw` as the cloud should receive it. */
export const withoutOrganizationId = (raw: unknown): unknown => {
  if (!raw || typeof raw !== "object") return raw;
  const { organizationId: _organizationId, ...rest } = raw as Record<
    string,
    unknown
  >;
  return rest;
};
