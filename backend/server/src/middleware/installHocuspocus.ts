import { Server } from "@hocuspocus/server";
import type { YState } from "@repo/base-plugin";
import { DisposableDocumentManager, YjsState } from "@repo/base-plugin/server";
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

const disposableDocumentManager: DisposableDocumentManager =
  new DisposableDocumentManager();

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
      await withUserPgPool(app, data.context.session_id, async (client) => {
        const {
          rows: [row],
        } = await client.query(
          "select * from app_public.projects where id = $1",
          [data.documentName],
        );
        if (!row) {
          throw new Error("Not Authorized");
        }
      });
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
      });
    },
    afterUnloadDocument: async (data) => {
      disposableDocumentManager.disposeDocument(data.documentName);
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

      const dummyRes = new ServerResponse(request);

      await applyMiddleware(
        websocketMiddlewares as Middleware<IncomingMessage, ServerResponse>[],
        request,
        dummyRes,
      );

      // Everyone needs to be logged in
      if (!request?.user?.session_id) {
        incoming.close(
          401,
          JSON.stringify({
            message:
              "You do not have permission to use this WebSocket connection",
          }),
        );
        return;
      }

      Server.handleConnection(incoming, request, {
        session_id: request.user.session_id,
      });
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
  user: { session_id: string };
}
