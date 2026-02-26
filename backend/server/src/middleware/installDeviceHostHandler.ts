import { logger } from "@repo/observability";
import axios from "axios";
import { json } from "body-parser";
import cookie from "cookie";
import signature from "cookie-signature";
import { Express } from "express";
import { PoolClient } from "pg";
import uid from "uid-safe";

import { getShutdownActions } from "../app";
import { getRootPgPool } from "./installDatabasePools";
import { disposableDocumentManager } from "./installHocuspocus";
import { getSessionStore } from "./installSession";

const PING_INTERVAL_MS = 30000; // 30 seconds
const JITTER_MAX_MS = 5000; // Maximum jitter of 5 seconds

// Returns a random jitter value between 0 and JITTER_MAX_MS
const getJitter = () => Math.random() * JITTER_MAX_MS;

interface CloudConnection {
  id: string;
  organization_id: string;
  host: string;
  session_cookie: string;
  session_cookie_expiry: Date;
  target_organization_slug: string | null;
  creator_user_id: string | null;
}

/**
 * This middleware runs code for a host device - Meaning an instance like the desktop app
 * When a project is connected to the cloud, we want to notify them of our existence
 * For this, we open up an iroh endpoint & poll it to the cloud
 */
export default (app: Express) => {
  const rootPgPool = getRootPgPool(app);
  const shutdownActions = getShutdownActions(app);

  // Map of cloud connection id to its polling interval
  const activePollers = new Map<string, NodeJS.Timeout>();

  let irohEndpointId: string | null = null;
  let irohTicket: string | null = null;
  let isInitialized = false;

  // Cache for host session cookies per cloud connection
  const hostSessionCookies = new Map<string, string>();

  // Get or create a session cookie for the host to use when proxied requests come back
  const getHostSessionCookie = async (
    cloudConnection: CloudConnection,
  ): Promise<string | null> => {
    const cached = hostSessionCookies.get(cloudConnection.id);
    if (cached) {
      return cached;
    }

    // If no creator_user_id, we can't create a session
    if (!cloudConnection.creator_user_id) {
      logger.debug(
        { cloudConnectionId: cloudConnection.id },
        "No creator_user_id for cloud connection, cannot create host session",
      );
      return null;
    }

    try {
      const { rows } = await rootPgPool.query<{ uuid: string }>(
        `INSERT INTO app_private.sessions (user_id) VALUES ($1) RETURNING uuid`,
        [cloudConnection.creator_user_id],
      );

      if (rows.length === 0) {
        logger.error(
          { cloudConnectionId: cloudConnection.id },
          "Failed to create session - no rows returned",
        );
        return null;
      }

      const sessionUuid = rows[0]!.uuid;

      // Create the session data - following how express-session does it
      const sid = uid.sync(24);
      const age = 3 * 24 * 60 * 60 * 1000; // 3 days
      const sessionData = {
        cookie: {
          originalMaxAge: age,
          expires: new Date(Date.now() + age).toISOString(),
          httpOnly: true,
          path: "/",
          sameSite: "lax",
        },
        passport: {
          user: sessionUuid,
        },
      };

      // Store in the session store (Redis or Postgres)
      const store = getSessionStore(app);
      await new Promise<void>((resolve, reject) => {
        store.set(sid, sessionData as any, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      // Format the cookie
      const signed = "s:" + signature.sign(sid, process.env.SECRET!);
      const cookieValue = cookie.serialize("connect.sid", signed);
      hostSessionCookies.set(cloudConnection.id, cookieValue);

      logger.info(
        { cloudConnectionId: cloudConnection.id },
        "Created host session cookie for cloud connection",
      );

      return cookieValue;
    } catch (err) {
      logger.error(
        { cloudConnectionId: cloudConnection.id, err },
        "Failed to create host session cookie",
      );
      return null;
    }
  };

  // This endpoint initializes the device host handler with iroh connection info.
  // The rust code (Tauri) calls this once on startup.
  // E2E tests can call it again to trigger an immediate sync of active projects.
  app.post("/device/host/init", json(), async (req, res) => {
    try {
      const { irohEndpointId: endpointId, irohTicket: ticket } = req.body;

      if (!endpointId || !ticket) {
        logger.warn(
          { body: req.body },
          "Missing irohEndpointId or irohTicket in init request",
        );
        res.status(400).json({
          error: "Missing required fields: irohEndpointId and irohTicket",
        });
        return;
      }

      const wasAlreadyInitialized = isInitialized;

      irohEndpointId = endpointId;
      irohTicket = ticket;
      isInitialized = true;

      logger.info(
        { irohEndpointId, wasAlreadyInitialized },
        "Host device initialized with iroh connection info",
      );

      // Sync polling state
      syncPollingState().catch((err) => {
        logger.error(
          { err },
          "Failed to sync polling state after initialization",
        );
      });

      // Only setup listener on first init
      if (!wasAlreadyInitialized) {
        setupNotifyListener().catch((err) => {
          logger.error({ err }, "Failed to initialize notify listener");
        });
        console.log("Device initialized");
      } else {
        console.log("Device re-synced");
      }

      res.json({ success: true });
    } catch (err) {
      logger.error({ err }, "Error handling /device/host/init request");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Stop the device host handler - stops all polling and resets state
  app.post("/device/host/stop", json(), async (req, res) => {
    try {
      if (!isInitialized) {
        res.json({ success: true, message: "Already stopped" });
        return;
      }

      logger.info("Stopping device host handler");

      // Stop all polling
      stopAllPolling();

      // Release listener client
      if (listenerClient) {
        listenerClient.release();
        listenerClient = null;
      }

      // Reset state
      irohEndpointId = null;
      irohTicket = null;
      isInitialized = false;

      console.log("Device stopped");

      res.json({ success: true });
    } catch (err) {
      logger.error({ err }, "Error handling /device/host/stop request");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const pingCloudConnection = async (
    cloudConnection: CloudConnection,
    hostSessionCookie: string | null,
  ) => {
    // Don't ping if not initialized
    if (!isInitialized || !irohEndpointId || !irohTicket) {
      logger.trace(
        { cloudConnectionId: cloudConnection.id },
        "Skipping ping - iroh not initialized yet",
      );
      return;
    }

    try {
      // Get active project ids that belong to this cloud connection's organization
      const activeProjectIds = disposableDocumentManager.getActiveDocuments();

      // DEBT: Make more efficient?
      let filteredProjectIds: string[] = [];
      if (activeProjectIds.length > 0) {
        const { rows } = await rootPgPool.query<{ id: string }>(
          `SELECT id FROM app_public.projects WHERE id = ANY($1) AND organization_id = $2`,
          [activeProjectIds, cloudConnection.organization_id],
        );
        filteredProjectIds = rows.map((r) => r.id);
      }

      await axios.post(
        `${cloudConnection.host}/device/server/ping`,
        {
          organizationSlug: cloudConnection.target_organization_slug,
          irohEndpointId,
          irohTicket,
          activeProjectIds: filteredProjectIds,
          hostSessionCookie,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Cookie: cloudConnection.session_cookie,
            "x-top-csrf-protection": "1",
            origin: cloudConnection.host,
          },
        },
      );

      logger.trace(
        { cloudConnectionId: cloudConnection.id },
        "Successfully pinged cloud connection",
      );
    } catch (err) {
      logger.error(
        { cloudConnectionId: cloudConnection.id, err },
        "Error pinging cloud connection",
      );
    }
  };

  const scheduleNextPing = (cloudConnection: CloudConnection) => {
    const jitteredInterval = PING_INTERVAL_MS + getJitter();
    const timeoutId = setTimeout(async () => {
      const hostSessionCookie = await getHostSessionCookie(cloudConnection);
      pingCloudConnection(cloudConnection, hostSessionCookie);
      // Only schedule next if still active
      if (activePollers.has(cloudConnection.id)) {
        scheduleNextPing(cloudConnection);
      }
    }, jitteredInterval);

    activePollers.set(cloudConnection.id, timeoutId);
  };

  const startPolling = (cloudConnection: CloudConnection) => {
    // Don't start if already polling
    if (activePollers.has(cloudConnection.id)) {
      return;
    }
    // Don't start also if they haven't chosen the target org
    if (cloudConnection.target_organization_slug === null) {
      return;
    }

    // Ping immediately with initial jitter to spread out requests on startup
    const initialDelay = getJitter();
    setTimeout(async () => {
      const hostSessionCookie = await getHostSessionCookie(cloudConnection);
      pingCloudConnection(cloudConnection, hostSessionCookie);
    }, initialDelay);

    // Schedule the first recurring ping after initial delay + base interval
    setTimeout(() => {
      scheduleNextPing(cloudConnection);
    }, initialDelay);

    // Store a placeholder timeout that will be replaced by scheduleNextPing
    activePollers.set(
      cloudConnection.id,
      setTimeout(() => {}, 0),
    );

    logger.info(
      { cloudConnectionId: cloudConnection.id, initialDelayMs: initialDelay },
      "Started polling for cloud connection",
    );
  };

  const stopPolling = (cloudConnectionId: string) => {
    const timeoutId = activePollers.get(cloudConnectionId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      activePollers.delete(cloudConnectionId);
      logger.info(
        { cloudConnectionId },
        "Stopped polling for cloud connection",
      );
    }
  };

  const stopAllPolling = () => {
    for (const [cloudConnectionId, timeoutId] of activePollers) {
      clearTimeout(timeoutId);
      logger.info(
        { cloudConnectionId },
        "Stopped polling for cloud connection (shutdown)",
      );
    }
    activePollers.clear();
  };

  // Synchronize polling state with database
  // Fetches all cloud connections and starts/stops polling as needed
  const syncPollingState = async () => {
    // Don't start polling if not initialized
    if (!isInitialized) {
      logger.debug("Skipping polling sync - not initialized yet");
      return;
    }
    const { rows } = await rootPgPool.query<CloudConnection>(`
      SELECT * FROM app_public.cloud_connections
    `);

    const currentIds = new Set(rows.map((cc) => cc.id));
    const pollingIds = new Set(activePollers.keys());

    // Stop polling for removed connections
    for (const pollingId of pollingIds) {
      if (!currentIds.has(pollingId)) {
        stopPolling(pollingId);
      }
    }

    // Trigger ping for current connections
    Array.from(activePollers.entries()).forEach(
      async ([cloudConnectionId, timeoutId]) => {
        clearTimeout(timeoutId);

        const cloudConnection = rows.find((x) => x.id === cloudConnectionId)!;
        const hostSessionCookie = await getHostSessionCookie(cloudConnection);
        pingCloudConnection(cloudConnection, hostSessionCookie);
        scheduleNextPing(cloudConnection);
      },
    );

    // Start or update polling for new/existing connections
    for (const cloudConnection of rows) {
      if (!activePollers.has(cloudConnection.id)) {
        startPolling(cloudConnection);
      }
    }
  };

  let listenerClient: PoolClient | null = null;

  const setupNotifyListener = async () => {
    listenerClient = await rootPgPool.connect();

    // Listen for changes to cloud_connections
    listenerClient.on("notification", async (msg) => {
      if (msg.channel === "graphql:cloud_connections") {
        logger.debug(
          { payload: msg.payload },
          "Received cloud_connections notification",
        );

        // Re-sync polling state with database
        try {
          await syncPollingState();
        } catch (err) {
          logger.error(
            { err },
            "Failed to sync polling state after notification",
          );
        }
      }
    });

    listenerClient.on("error", (err) => {
      logger.error({ err }, "Listener client error");
      setTimeout(() => {
        setupNotifyListener().catch((err) => {
          logger.error({ err }, "Failed to reconnect listener");
        });
      }, 5000);
    });

    await listenerClient.query('LISTEN "graphql:cloud_connections"');

    disposableDocumentManager.onDocumentsChange(() => {
      syncPollingState();
    });

    logger.info("LISTEN setup complete for graphql:cloud_connections");
  };

  shutdownActions.push(() => {
    stopAllPolling();
    if (listenerClient) {
      listenerClient.release();
      listenerClient = null;
    }
  });
};
