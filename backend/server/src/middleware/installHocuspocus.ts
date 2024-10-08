import { Server } from "@hocuspocus/server";
import type {
  IDisposable,
  ObjectToTypedMap,
  Scene,
  State,
  YState,
} from "@repo/base-plugin";
import { Express } from "express";
import { IncomingMessage, ServerResponse } from "http";
import { Middleware } from "postgraphile";
import { Duplex } from "stream";
import { typeidUnboxed } from "typeid-js";
import { proxy } from "valtio";
import { bind } from "valtio-yjs";
import WebSocket, { WebSocketServer } from "ws";
import * as Y from "yjs";

import { getUpgradeHandlers, getWebsocketMiddlewares } from "../app";
import { serverPluginApi } from "../pluginManager";
import { getAuthPgPool, getRootPgPool } from "./installDatabasePools";

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
      const rootPgPool = getRootPgPool(app);
      await rootPgPool.query(
        "update app_public.projects set document = $1 where id = $2",
        [Buffer.from(Y.encodeStateAsUpdate(data.document)), data.documentName],
      );
    },
    onAuthenticate: async (data) => {
      const authPgPool = getAuthPgPool(app);

      const sessionId = data.context.session_id;

      const client = await authPgPool.connect();
      try {
        await client.query("BEGIN");

        await client.query(
          `select set_config('role', $1::text, true), set_config('jwt.claims.session_id', $2::text, true)`,
          [process.env.DATABASE_VISITOR, sessionId],
        );
        const {
          rows: [row],
        } = await client.query(
          "select * from app_public.projects where id = $1",
          [data.documentName],
        );
        if (!row) {
          throw new Error("Not Authorized");
        }

        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
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
              overlay: null,
              children: {},
            },
          },
        } satisfies State);
        const unbind = bind(mainState, yDoc.getMap());

        const update = Y.encodeStateAsUpdate(yDoc);

        dbDocument = update;
        await rootPgPool.query(
          "update app_public.projects set document = $1 where id = $2",
          [update, data.documentName],
        );
        unbind();
      }

      if (dbDocument) {
        Y.applyUpdate(data.document, dbDocument);
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
      const registeredOnRendererDataCreated =
        serverPluginApi.getRegisteredOnRendererDataCreated();
      const registeredOnRendererDataLoaded =
        serverPluginApi.getRegisteredOnRendererDataLoaded();

      const handleSectionOrScene = (
        sectionOrScene: ObjectToTypedMap<any>,
        id: string,
        isJustCreated: boolean = false,
      ) => {
        if (sectionOrScene.get("type") === "section") {
          return;
        }

        const sceneId = id;

        const scene = sectionOrScene as ObjectToTypedMap<
          Scene<Record<string, any>>
        >;

        // First, let's make sure that the scene & plugin is reflected in `renderer`
        state.get("renderer")?.forEach((renderData) => {
          const sceneKeys = Array.from(
            renderData.get("children")?.keys() ?? [],
          );

          const sceneChildrenEntries = Array.from(
            scene.get("children")?.entries()!,
          );

          if (!sceneKeys.includes(sceneId)) {
            // Create the scene object with all the plugins as well
            const sceneMap = new Y.Map();

            sceneChildrenEntries.forEach(([pluginId, pluginInfo]) => {
              const pluginMap = new Y.Map();

              try {
                disposableDocumentManager
                  .getDocumentDisposable(data.documentName)
                  .push(
                    registeredOnRendererDataCreated
                      .find((x) => x.pluginName === pluginInfo.get("plugin"))
                      ?.callback(pluginMap, {
                        pluginId,
                        sceneId,
                        organizationId,
                      }) ?? {},
                  );
              } catch (e) {
                console.error(
                  "Error: Error occurred while running the `onRendererDataCreated` function in " +
                    pluginInfo.get("plugin"),
                );
                console.error(e);
              }

              sceneMap.set(pluginId, pluginMap);
            });

            // Then we can set it all at once
            renderData
              .get("children")
              ?.set(
                sceneId,
                sceneMap as ObjectToTypedMap<
                  Record<string, Record<string, any>>
                >,
              );
          } else {
            // Otherwise we just add the plugin
            const plugins = renderData.get("children")?.get(sceneId);
            const currentPluginIds = Array.from(plugins?.keys()!);
            const missingPlugins = sceneChildrenEntries.filter(
              ([pluginId]) => !currentPluginIds.includes(pluginId),
            );

            if (missingPlugins.length > 0) {
              document?.transact(() => {
                for (const [pluginId, pluginInfo] of missingPlugins) {
                  const pluginMap = new Y.Map();

                  try {
                    disposableDocumentManager
                      .getDocumentDisposable(data.documentName)
                      .push(
                        registeredOnRendererDataCreated
                          .find(
                            (x) => x.pluginName === pluginInfo.get("plugin"),
                          )
                          ?.callback(pluginMap, {
                            pluginId,
                            sceneId,
                            organizationId,
                          }) ?? {},
                      );
                  } catch (e) {
                    console.error(
                      "Error: Error occurred while running the `onRendererDataCreated` function in " +
                        pluginInfo.get("plugin"),
                    );
                    console.error(e);
                  }

                  plugins?.set(
                    pluginId,
                    pluginMap as ObjectToTypedMap<Record<string, any>>,
                  );
                }
              });
            }
          }

          // Handle renderer load
          for (const [pluginId, pluginInfo] of sceneChildrenEntries) {
            try {
              disposableDocumentManager
                .getDocumentDisposable(data.documentName)
                .push(
                  registeredOnRendererDataLoaded
                    .find((x) => x.pluginName === pluginInfo.get("plugin"))
                    ?.callback(pluginInfo, {
                      pluginId,
                      sceneId,
                      organizationId,
                    }) ?? {},
                );
            } catch (e) {
              console.error(
                "Error: Error occurred while running the `onRendererDataLoaded` function in " +
                  pluginInfo.get("plugin"),
              );
              console.error(e);
            }
          }
        });

        // Then we can start registering the hook to the plugins
        const children = scene?.get("children");

        children?.observe((event) => {
          // TODO:
          // Handle when new plugin are added or removed within a scene
          console.log(event);
        });

        for (const [pluginId, pluginInfo] of children?.entries() ?? []) {
          if (isJustCreated) {
            try {
              disposableDocumentManager
                .getDocumentDisposable(data.documentName)
                .push(
                  registeredOnPluginDataCreated
                    .find((x) => x.pluginName === pluginInfo.get("plugin"))
                    ?.callback(pluginInfo, {
                      pluginId,
                      sceneId,
                      organizationId,
                    }) ?? {},
                );
            } catch (e) {
              console.error(
                "Error: Error occurred while running the `onPluginDataCreated` function in " +
                  pluginInfo.get("plugin"),
              );
              console.error(e);
            }
          }
          try {
            disposableDocumentManager
              .getDocumentDisposable(data.documentName)
              .push(
                registeredOnPluginDataLoaded
                  .find((x) => x.pluginName === pluginInfo.get("plugin"))
                  ?.callback(pluginInfo, {
                    pluginId,
                    sceneId,
                    organizationId,
                  }) ?? {},
              );
          } catch (e) {
            console.error(
              "Error: Error occurred while running the `onPluginDataLoaded` function in " +
                pluginInfo.get("plugin"),
            );
            console.error(e);
          }
        }
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
        const errorMessage = JSON.stringify({
          type: "error",
          code: 401,
          message:
            "You do not have permission to use this WebSocket connection",
        });
        incoming.send(errorMessage);
        incoming.close();
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
