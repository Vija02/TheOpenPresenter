import { cloud } from "@repo/backend-shared";
import { logger } from "@repo/observability";
import { Express } from "express";
import { PoolClient } from "pg";

import { isCloudEnabled } from "../api/cloud/cloudEnabled";
import { getShutdownActions } from "../app";
import { getRootPgPool } from "./installDatabasePools";

/**
 * Live cloud sync: queue a sync whenever something it covers changes here
 * We also subscribe to changes in cloud
 */

const MEDIA_ENTITIES = new Set([
  "app_public.medias",
  "app_public.project_medias",
]);
const CONNECTIONS_CHANNEL = "graphql:cloud_connections";
const RECONNECT_DELAY_MS = 5000;

type Connection = {
  id: string;
  host: string;
  sessionCookie: string;
  organizationSlug: string;
  expiresAt: number;
};

type Hint = { entity?: string; origin?: string | null };

const channelFor = (organizationId: string) => `cloud_sync:${organizationId}`;

export default async (app: Express) => {
  const rootPgPool = getRootPgPool(app);
  const shutdownActions = getShutdownActions(app);

  try {
    // Attach for new tables
    await rootPgPool.query("select app_private.attach_cloud_sync_hints()");
  } catch (err) {
    logger.error({ err }, "Failed to attach cloud sync hints");
  }

  // No connections can be made, so no hints to queue syncs for.
  if (!isCloudEnabled()) return;

  let listener: PoolClient | null = null;
  let stopped = false;
  /** Usable connections by organization: the channels listened to. */
  let byOrganization = new Map<string, Connection[]>();
  /** The cloud's hints, per connection; the key changes with its login. */
  const subscriptions = new Map<string, { key: string; dispose: () => void }>();

  const refreshChannels = async (client: PoolClient) => {
    const { rows } = await rootPgPool.query<{
      id: string;
      organization_id: string;
      host: string;
      session_cookie: string;
      target_organization_slug: string;
      session_cookie_expiry: Date;
    }>(
      `select id, organization_id, host, session_cookie,
              target_organization_slug, session_cookie_expiry
       from app_public.cloud_connections
       where target_organization_slug is not null
         and session_cookie_expiry > now()`,
    );
    // Shut down meanwhile: subscribing now would outlive the server.
    if (stopped) return;
    const next = new Map<string, Connection[]>();
    for (const row of rows) {
      const connections = next.get(row.organization_id) ?? [];
      connections.push({
        id: row.id,
        host: row.host,
        sessionCookie: row.session_cookie,
        organizationSlug: row.target_organization_slug,
        expiresAt: new Date(row.session_cookie_expiry).getTime(),
      });
      next.set(row.organization_id, connections);
    }
    for (const organizationId of byOrganization.keys()) {
      if (!next.has(organizationId)) {
        await client.query(`UNLISTEN "${channelFor(organizationId)}"`);
      }
    }
    for (const organizationId of next.keys()) {
      if (!byOrganization.has(organizationId)) {
        await client.query(`LISTEN "${channelFor(organizationId)}"`);
      }
    }
    byOrganization = next;
    refreshSubscriptions();
  };

  /** As of the last refresh, e.g. with an expiry the cloud has extended. */
  const currentConnection = (id: string) =>
    [...byOrganization.values()].flat().find((c) => c.id === id);

  const refreshSubscriptions = () => {
    if (stopped) return;
    const connections = [...byOrganization.values()].flat();
    for (const [id, subscription] of subscriptions) {
      if (!connections.some((c) => c.id === id)) {
        subscription.dispose();
        subscriptions.delete(id);
      }
    }
    for (const connection of connections) {
      const key = [
        connection.host,
        connection.sessionCookie,
        connection.organizationSlug,
      ].join("\0");
      const existing = subscriptions.get(connection.id);
      if (existing?.key === key) continue;
      existing?.dispose();
      subscriptions.set(connection.id, {
        key,
        dispose: subscribe(connection),
      });
    }
  };

  const subscribe = (connection: Connection) =>
    cloud.subscribeToCloudHints({
      host: connection.host,
      sessionCookie: connection.sessionCookie,
      organizationSlug: connection.organizationSlug,
      onHint: (hint) => {
        // The cloud's record of our own sync's writes.
        if (hint.origin === connection.id) return;
        const current = currentConnection(connection.id);
        if (!current || current.expiresAt <= Date.now()) return;
        queue(
          connection.id,
          MEDIA_ENTITIES.has(hint.entity ?? "")
            ? "cloud_media_change"
            : "cloud_change",
        );
      },
      onReconnected: () => queue(connection.id, "reconnect"),
      // Until its login changes; the scheduled sync still runs.
      onRefused: (errors) => {
        logger.warn(
          { connectionId: connection.id, errors },
          "Cloud refused live sync hints; relying on scheduled syncs",
        );
      },
    });

  const queue = (connectionId: string, trigger: cloud.CloudSyncTrigger) =>
    cloud.queueCloudSync(rootPgPool, connectionId, { trigger }).catch((err) => {
      logger.error({ err, connectionId }, "Failed to queue live cloud sync");
    });

  const onHint = (organizationId: string, payload: string | undefined) => {
    let hint: Hint = {};
    try {
      hint = JSON.parse(payload ?? "{}");
    } catch {
      // Still a change; sync everything it could be.
    }
    const trigger = MEDIA_ENTITIES.has(hint.entity ?? "")
      ? "local_media_change"
      : "local_change";
    for (const connection of byOrganization.get(organizationId) ?? []) {
      // The sync's own write: on both sides already.
      if (hint.origin === connection.id) continue;
      // A sync would only fail on the cloud's login.
      if (connection.expiresAt <= Date.now()) continue;
      queue(connection.id, trigger);
    }
  };

  const connect = async (reconnecting: boolean) => {
    const client = await rootPgPool.connect();
    listener = client;
    byOrganization = new Map();

    client.on("notification", (msg) => {
      if (msg.channel === CONNECTIONS_CHANNEL) {
        refreshChannels(client).catch((err) => {
          logger.error({ err }, "Failed to refresh cloud sync channels");
        });
      } else if (msg.channel.startsWith("cloud_sync:")) {
        onHint(msg.channel.slice("cloud_sync:".length), msg.payload);
      }
    });
    client.on("error", (err) => {
      logger.error({ err }, "Cloud sync listener error; reconnecting");
      client.release(err);
      if (listener === client) listener = null;
      scheduleReconnect();
    });

    await client.query(`LISTEN "${CONNECTIONS_CHANNEL}"`);
    await refreshChannels(client);

    // Hints sent while nobody listened are gone; sync to catch up.
    if (reconnecting) {
      for (const connections of byOrganization.values()) {
        for (const { id } of connections) queue(id, "local_change");
      }
    }
  };

  const scheduleReconnect = () => {
    if (stopped) return;
    setTimeout(() => {
      connect(true).catch((err) => {
        logger.error({ err }, "Failed to reconnect cloud sync listener");
        scheduleReconnect();
      });
    }, RECONNECT_DELAY_MS);
  };

  try {
    await connect(false);
  } catch (err) {
    logger.error({ err }, "Failed to start cloud sync listener");
    scheduleReconnect();
  }

  shutdownActions.push(() => {
    stopped = true;
    listener?.release();
    listener = null;
    for (const { dispose } of subscriptions.values()) dispose();
    subscriptions.clear();
  });
};
