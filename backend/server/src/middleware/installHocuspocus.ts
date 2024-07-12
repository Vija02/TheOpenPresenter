import { Express } from "express";
import { IncomingMessage } from "http";
import { Duplex } from "stream";
import WebSocket, { WebSocketServer } from "ws";

import { getUpgradeHandlers } from "../app";

export default async function installHocuspocus(app: Express) {
  const { Server } = await import("@hocuspocus/server");

  Server.configure({
    name: "Hocuspocus Server",
  });

  const webSocketServer = new WebSocketServer({ noServer: true });

  webSocketServer.on(
    "connection",
    async (incoming: WebSocket, request: IncomingMessage) => {
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

      Server.handleConnection(incoming, request);
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
