import { Server } from "@hocuspocus/server";
import type {
  IDisposable,
  ObjectToTypedMap,
  Scene,
  Section,
  YState,
} from "@repo/base-plugin";
import { Express } from "express";
import { IncomingMessage } from "http";
import { Duplex } from "stream";
import { typeidUnboxed } from "typeid-js";
import { proxy } from "valtio";
import { bind } from "valtio-yjs";
import WebSocket, { WebSocketServer } from "ws";
import * as Y from "yjs";

import { getUpgradeHandlers } from "../app";
import { serverPluginApi } from "../pluginManager";

// TODO: Use DB
const temporaryDatabase: Record<string, any> = {};

class DisposableDocumentManager {
  private disposable: Record<string, IDisposable[]> = {};

  getDocumentDisposable(documentName: string) {
    if (!this.disposable[documentName]) {
      this.disposable[documentName] = [];
    }

    return this.disposable[documentName]!;
  }

  disposeDocument(documentName: string) {
    this.disposable[documentName]?.forEach((x) => {
      x.dispose?.();
    });
    delete this.disposable[documentName];
  }
}
const disposableDocumentManager: DisposableDocumentManager =
  new DisposableDocumentManager();

export default async function installHocuspocus(app: Express) {
  Server.configure({
    name: "Hocuspocus Server",
    onStoreDocument: async (data) => {
      temporaryDatabase[data.documentName] = Buffer.from(
        Y.encodeStateAsUpdate(data.document),
      );
    },
    onLoadDocument: async (data) => {
      if (!temporaryDatabase[data.documentName]) {
        const yDoc = new Y.Doc();
        // Initial state. We use valtio here so that we can define it as JSON
        const mainState = proxy({
          meta: {
            id: typeidUnboxed("project"),
            name: "",
            createdAt: new Date().toISOString(),
          },
          data: {},
          renderer: {
            "1": {
              currentScene: null,
              children: {},
            },
          },
        });
        const unbind = bind(mainState, yDoc.getMap());

        const update = Y.encodeStateAsUpdate(yDoc);

        temporaryDatabase[data.documentName] = update;
        unbind();
      }

      const update = temporaryDatabase[data.documentName];

      if (update) {
        Y.applyUpdate(data.document, update);
      }

      /**
       * Now we can start hooking the data to our plugins
       */
      const document = data.instance.documents.get(data.documentName);
      const state = document?.getMap() as YState;

      const dataMap = state.get("data");

      const registeredOnPluginDataCreated =
        serverPluginApi.getRegisteredOnPluginDataCreated();
      const registeredOnPluginDataLoaded =
        serverPluginApi.getRegisteredOnPluginDataLoaded();

      const handleSectionOrScene = (
        sectionOrScene: ObjectToTypedMap<Section | Scene<Record<string, any>>>,
        id: string,
        isJustCreated: boolean = false,
      ) => {
        if (sectionOrScene.get("type") === "section") {
          return;
        }

        const scene = sectionOrScene as ObjectToTypedMap<
          Scene<Record<string, any>>
        >;

        // First, let's make sure that the scene & plugin is reflected in `renderer`
        state.get("renderer")?.forEach((renderData) => {
          const sceneKeys = Array.from(
            renderData.get("children")?.keys() ?? [],
          );

          const pluginIds = Array.from(scene.get("children")?.keys()!);
          if (!sceneKeys.includes(id)) {
            // Create the scene object with all the plugins as well
            const renderMap = new Y.Map();
            pluginIds.forEach((x) => renderMap.set(x, new Y.Map()));

            // Then we can set it all at once
            renderData
              .get("children")
              ?.set(
                id,
                renderMap as ObjectToTypedMap<
                  Record<string, Record<string, any>>
                >,
              );
          } else {
            // Otherwise we just add the plugin
            const plugins = renderData.get("children")?.get(id);
            const currentPluginIds = Array.from(plugins?.keys()!);
            const missingPluginIds = pluginIds.filter(
              (x) => !currentPluginIds.includes(x),
            );

            document?.transact(() => {
              for (const missingId of missingPluginIds) {
                plugins?.set(
                  missingId,
                  new Y.Map() as ObjectToTypedMap<Record<string, any>>,
                );
              }
            });
          }
        });

        // Then we can start registering the hook to the plugins
        const children = scene?.get("children");

        children?.observe((event) => {
          // TODO:
          // Handle when new plugin are added or removed within a scene
          console.log(event);
        });

        children?.forEach((pluginInfo) => {
          if (isJustCreated) {
            disposableDocumentManager
              .getDocumentDisposable(data.documentName)
              .push(
                registeredOnPluginDataCreated
                  .find((x) => x.pluginName === pluginInfo.get("plugin"))
                  ?.callback(pluginInfo) ?? {},
              );
          }
          disposableDocumentManager
            .getDocumentDisposable(data.documentName)
            .push(
              registeredOnPluginDataLoaded
                .find((x) => x.pluginName === pluginInfo.get("plugin"))
                ?.callback(pluginInfo) ?? {},
            );
        });
      };
      // Initial load
      dataMap?.forEach((sectionOrScene, id) => {
        handleSectionOrScene(sectionOrScene, id);
      });

      // Handle new scenes that is added
      dataMap?.observe((event) => {
        event.keys.forEach((value, key) => {
          if (value.action === "add") {
            const sectionOrScene = dataMap.get(key)!;

            handleSectionOrScene(sectionOrScene, key, true);
          } else if (value.action === "delete") {
            // TODO: Delete the listener (Check if scene)
          }
        });
      });
    },
    afterUnloadDocument: async (data) => {
      disposableDocumentManager.disposeDocument(data.documentName);
    },
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
