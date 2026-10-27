import { logger } from "@repo/observability";
import { createClient } from "graphql-ws";

import { websocketUrl, websocketWithCookie } from "./remoteDocument";

/**
 * Live cloud sync. Subscribe to cloud for changes there.
 */

const CLOUD_ORGANIZATION_CHANGED = `
  subscription CloudOrganizationChanged($organizationSlug: String!) {
    cloudOrganizationChanged(organizationSlug: $organizationSlug) {
      entity
      origin
    }
  }
`;

const RETRY_MAX_MS = 60_000;
// After the cloud answered a subscribe with an error that may pass.
const RESUBSCRIBE_MS = 5 * 60_000;
const KEEP_ALIVE_MS = 20_000;

export type CloudHint = { entity: string | null; origin: string | null };

type Options = {
  host: string;
  sessionCookie: string;
  organizationSlug: string;
  onHint: (hint: CloudHint) => void;
  /** Connected again after losing the connection: hints were missed. */
  onReconnected: () => void;
  /**
   * The cloud refused the subscription: older than it, or the login cannot
   * see the organization. Retrying cannot help, so it has stopped.
   */
  onRefused: (errors: readonly unknown[]) => void;
  /** Defaults to 5 minutes. */
  resubscribeMs?: number;
};

/** Errors no retry can fix; anything else, e.g. the cloud's database, may pass. */
const isRefusal = (errors: readonly unknown[]) =>
  errors.some((e) => {
    const message = String((e as { message?: unknown })?.message ?? "");
    return (
      message.includes("Cannot query field") ||
      message.includes("You do not have access")
    );
  });

/** Subscribe until the returned function is called. */
export const subscribeToCloudHints = ({
  host,
  sessionCookie,
  organizationSlug,
  onHint,
  onReconnected,
  onRefused,
  resubscribeMs = RESUBSCRIBE_MS,
}: Options): (() => void) => {
  const client = createClient({
    url: websocketUrl(host, "/graphql"),
    webSocketImpl: websocketWithCookie(sessionCookie, host),
    lazy: false,
    keepAlive: KEEP_ALIVE_MS,
    // The cloud being away is ordinary; keep coming back.
    retryAttempts: Infinity,
    shouldRetry: () => true,
    retryWait: async (retries) => {
      const ms = Math.min(1000 * 2 ** retries, RETRY_MAX_MS);
      await new Promise((resolve) =>
        setTimeout(resolve, ms * (0.5 + Math.random() / 2)),
      );
    },
    on: {
      connected: (_socket, _payload, wasRetry) => {
        if (wasRetry) onReconnected();
      },
    },
  });

  let disposed = false;
  let unsubscribe = () => {};
  let resubscribe: NodeJS.Timeout | null = null;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (resubscribe) clearTimeout(resubscribe);
    unsubscribe();
    client.dispose();
  };

  /**
   * The subscription ended without us ending it. A validation error (an
   * older cloud) arrives as an error; one from subscribing, e.g. the
   * membership check or the cloud's database, as a result with errors and
   * then completion.
   */
  const ended = (errors: readonly unknown[]) => {
    if (disposed) return;
    if (isRefusal(errors)) {
      dispose();
      onRefused(errors);
      return;
    }
    logger.warn(
      { errors, organizationSlug },
      "Cloud ended live sync hints; subscribing again later",
    );
    resubscribe = setTimeout(() => {
      resubscribe = null;
      if (disposed) return;
      start();
      // Hints sent meanwhile were missed.
      onReconnected();
    }, resubscribeMs);
  };

  const start = () => {
    let errors: readonly unknown[] = [];
    unsubscribe = client.subscribe<{
      cloudOrganizationChanged: CloudHint | null;
    }>(
      { query: CLOUD_ORGANIZATION_CHANGED, variables: { organizationSlug } },
      {
        next: (result) => {
          if (result.errors?.length) errors = result.errors;
          if (result.data?.cloudOrganizationChanged) {
            onHint(result.data.cloudOrganizationChanged);
          }
        },
        // Retries never run out, so this is the cloud answering with errors.
        error: (err) => ended(Array.isArray(err) ? err : [err]),
        complete: () => ended(errors),
      },
    );
  };
  start();

  return dispose;
};
