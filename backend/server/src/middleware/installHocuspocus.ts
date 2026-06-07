import { Server } from "@hocuspocus/server";
import type { YState } from "@repo/base-plugin";
import { DisposableDocumentManager, YjsState } from "@repo/base-plugin/server";
import { logger } from "@repo/observability";
import { Express } from "express";
import { IncomingMessage, ServerResponse } from "http";
import { Middleware } from "postgraphile";
import { Duplex } from "stream";
import WebSocket, { WebSocketServer } from "ws";
import * as Y from "yjs";

import { getUpgradeHandlers, getWebsocketMiddlewares } from "../app";
import { serverPluginApi } from "../pluginManager";
import { withUserPgPool } from "../utils/withUserPgPool";
import { getRootPgPool } from "./installDatabasePools";
import { getMediaHandler } from "./installFileUpload";

export const disposableDocumentManager: DisposableDocumentManager =
  new DisposableDocumentManager();

const HEARTBEAT_THROTTLE_MS = 15_000;
const heartbeatThrottle = new Map<string, number>();
/** Throttles hearbeat. Returns true if can bump */
const throttleHeartbeatCanBump = (key: string): boolean => {
  const now = Date.now();
  const last = heartbeatThrottle.get(key) ?? 0;
  if (now - last < HEARTBEAT_THROTTLE_MS) return false;
  heartbeatThrottle.set(key, now);
  return true;
};

export default async function installHocuspocus(app: Express) {
  Server.configure({
    name: "Hocuspocus Server",
    onStoreDocument: async (data) => {
      const rootPgPool = getRootPgPool(app);
      await rootPgPool.query(
        "update app_public.projects set document = $1 where id = $2",
        [Buffer.from(Y.encodeStateAsUpdate(data.document)), data.documentName],
      );
    },
    onAuthenticate: async (data) => {
      const sessionId: string | null = data.context.session_id ?? null;
      const screenGuestSessionId: string | null =
        data.context.screen_guest_session_id ?? null;

      await withUserPgPool(
        app,
        sessionId,
        async (client) => {
          const {
            rows: [row],
          } = await client.query(
            // If they have access to the row, they have access to this project
            "select 1 from app_public.projects where id = $1",
            [data.documentName],
          );
          if (!row) {
            throw new Error("Not Authorized");
          }
        },
        screenGuestSessionId,
      );
    },
    onLoadDocument: async (data) => {
      const rootPgPool = getRootPgPool(app);

      const {
        rows: [row],
      } = await rootPgPool.query(
        "select * from app_public.projects where id = $1",
        [data.documentName],
      );

      const organizationId = row.organization_id;
      const projectId = row.id;
      let dbDocument = row.document;

      if (!dbDocument) {
        const yDoc = YjsState.createEmptyState();
        const update = Y.encodeStateAsUpdate(yDoc);

        dbDocument = update;
        await rootPgPool.query(
          "update app_public.projects set document = $1 where id = $2",
          [update, data.documentName],
        );
      }

      if (dbDocument) {
        Y.applyUpdate(data.document, dbDocument);
      }
      /**
       * Handle hooks & everything needed for the Yjs State
       */
      const document = data.instance.documents.get(data.documentName);
      const state = document?.getMap() as YState;

      YjsState.handleYjsDocumentLoad({
        document: document!,
        documentName: data.documentName,
        state,
        serverPluginApi,
        disposableDocumentManager,
        organizationId,
        projectId,
        onPluginDeleted: (pluginId) => {
          const mediaHandler = getMediaHandler(app);
          mediaHandler.unlinkPlugin(pluginId, { projectId });
        },
      });
    },
    // Signal heartbeat to screens
    onChange: async (data) => {
      const ctx = data.context as {
        session_id?: string | null;
        screen_guest_session_id?: string | null;
        screen_id?: string | null;
      };
      const rootPgPool = getRootPgPool(app);

      // Handle guest
      if (ctx.screen_guest_session_id) {
        const guestId = ctx.screen_guest_session_id;
        const screenId = ctx.screen_id ?? null;

        // Update guest's last_seen_at
        if (throttleHeartbeatCanBump(`guest-session:${guestId}`)) {
          rootPgPool
            .query(
              "update app_public.screen_guest_sessions set last_seen_at = now() where id = $1 and last_seen_at < now() - interval '15 seconds'",
              [guestId],
            )
            .catch((err) => {
              logger.warn({ err }, "Failed to bump guest last_seen_at");
            });
        }
        if (screenId && throttleHeartbeatCanBump(`guest-hb:${screenId}`)) {
          rootPgPool
            .query(
              `insert into app_public.screen_heartbeats (screen_id, last_seen_by_guest_at)
               values ($1, now())
               on conflict (screen_id) do update
                 set last_seen_by_guest_at = excluded.last_seen_by_guest_at
                 where coalesce(screen_heartbeats.last_seen_by_guest_at, '-infinity'::timestamptz)
                       < now() - interval '15 seconds'`,
              [screenId],
            )
            .catch((err) => {
              logger.warn({ err }, "Failed to bump screen heartbeat (guest)");
            });
        }
        return;
      }

      // Handle admin
      if (ctx.session_id) {
        const key = `admin-hb:${ctx.session_id}:${data.documentName}`;
        if (!throttleHeartbeatCanBump(key)) return;
        rootPgPool
          .query(
            `insert into app_public.screen_heartbeats (screen_id, last_seen_by_admin_at)
             select s.id, now()
             from app_public.screens s
             where s.current_project_id = $1
             on conflict (screen_id) do update
               set last_seen_by_admin_at = excluded.last_seen_by_admin_at
               where coalesce(screen_heartbeats.last_seen_by_admin_at, '-infinity'::timestamptz)
                     < now() - interval '15 seconds'`,
            [data.documentName],
          )
          .catch((err) => {
            logger.warn({ err }, "Failed to bump screen heartbeat (admin)");
          });
      }
    },
    afterUnloadDocument: async (data) => {
      disposableDocumentManager.disposeDocument(data.documentName);

      // Clean up temporary demo projects once they have no active connections.
      const rootPgPool = getRootPgPool(app);
      try {
        const { rowCount } = await rootPgPool.query(
          `delete from app_public.projects
           where id = $1
             and is_temporary = true
             and organization_id = (
               select id from app_public.organizations where slug = 'demo'
             )`,
          [data.documentName],
        );
        if (rowCount && rowCount > 0) {
          logger.info(
            { projectId: data.documentName },
            "Deleted temporary demo project after unload",
          );
        }
      } catch (err) {
        logger.error(
          { err, projectId: data.documentName },
          "Failed to delete temporary demo project after unload",
        );
      }
    },
  });

  const webSocketServer = new WebSocketServer({ noServer: true });
  const websocketMiddlewares = getWebsocketMiddlewares(app);

  webSocketServer.on(
    "connection",
    async (incoming: WebSocket, request: OurRequest) => {
      incoming.on("error", (error) => {
        /**
         * Handle a ws instance error, which is required to prevent
         * the server from crashing when one happens
         * See https://github.com/websockets/ws/issues/1777#issuecomment-660803472
         * @private
         */
        console.log("Error emitted from webSocket instance:");
        console.log(error);
      });

      try {
        const dummyRes = new ServerResponse(request);

        await applyMiddleware(
          websocketMiddlewares as Middleware<IncomingMessage, ServerResponse>[],
          request,
          dummyRes,
        );

        const sessionId = request.user?.session_id ?? null;
        const screenGuestSessionId =
          request.session?.screenGuestSession?.id ?? null;
        const screenId = request.session?.screenGuestSession?.screenId ?? null;

        Server.handleConnection(incoming, request, {
          session_id: sessionId,
          screen_guest_session_id: screenGuestSessionId,
          screen_id: screenId,
        });
      } catch (err) {
        logger.error({ err }, "Error handling WebSocket connection");
        try {
          incoming.close(4500, "Internal server error");
        } catch {
          incoming.terminate();
        }
      }
    },
  );

  const hocuspocusUpgradeHandler = async (
    req: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ) => {
    webSocketServer.handleUpgrade(req, socket, head, (ws) => {
      webSocketServer.emit("connection", ws, req);
    });
  };

  const upgradeHandlers = getUpgradeHandlers(app);
  upgradeHandlers.push({
    name: "Hocuspocus",
    check(req) {
      return req.url?.includes("/wlink") ?? false;
    },
    upgrade: hocuspocusUpgradeHandler,
  });
}

const applyMiddleware = async (
  middlewares: Array<Middleware<IncomingMessage, ServerResponse>> = [],
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> => {
  for (const middleware of middlewares) {
    await new Promise<void>((resolve, reject): void => {
      middleware(req, res, (err) => (err ? reject(err) : resolve()));
    });
  }
};

interface OurRequest extends IncomingMessage {
  user?: { session_id: string };
  session?: {
    screenGuestSession?: {
      id?: string | null;
      screenId?: string | null;
    } | null;
  };
}
