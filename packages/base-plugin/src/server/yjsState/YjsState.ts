import { typeidUnboxed } from "typeid-js";
import { proxy } from "valtio";
import { bind } from "valtio-yjs";
import * as Y from "yjs";

import {
  ObjectToTypedMap,
  OwnedScene,
  Plugin,
  RenderData,
  Scene,
  State,
  YState,
} from "../../types";
import { ServerPluginApiPrivate } from "../serverPlugin";
import { DisposableDocumentManager } from "./DisposableDocumentManager";

/**
 * Creates an empty Yjs doc and populate it without our default state
 */
const createEmptyState = () => {
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
        layout: null,
        ownedScenes: null,
      },
    },
  } satisfies State);
  const unbind = bind(mainState, yDoc.getMap());
  unbind();
  return yDoc;
};

/**
 * Given a single renderer and scene, this function will create missing yjs maps on the renderer
 * If the scene doesn't exist yet, it will create the scene along with the plugins in one go
 * If it already exist, it will add any missing plugin into the existing renderer scene
 */
const syncRenderDataForScene = ({
  renderData,
  scene,
  sceneId,
  onRendererDataCreated,
}: {
  renderData: ObjectToTypedMap<RenderData>;
  scene: ObjectToTypedMap<Scene>;
  sceneId: string;
  onRendererDataCreated: (val: {
    pluginId: string;
    pluginInfo: ObjectToTypedMap<Plugin>;
    rendererPluginMap: ObjectToTypedMap<any>;
  }) => void;
}) => {
  const sceneKeysInRenderData = Array.from(
    renderData.get("children")?.keys() ?? [],
  );

  const sceneChildrenEntries = Array.from(scene.get("children")?.entries()!);

  // If this is a new scene that doesn't exist in the renderData, then we want to add everything all together
  if (!sceneKeysInRenderData.includes(sceneId)) {
    // Create the scene object with all the plugins as well
    const rendererSceneMap = new Y.Map();

    sceneChildrenEntries.forEach(([pluginId, pluginInfo]) => {
      const rendererPluginMap = new Y.Map();

      onRendererDataCreated({ pluginId, pluginInfo, rendererPluginMap });

      rendererSceneMap.set(pluginId, rendererPluginMap);
    });

    // Then we can set it all at once
    renderData
      .get("children")
      ?.set(
        sceneId,
        rendererSceneMap as ObjectToTypedMap<
          Record<string, Record<string, any>>
        >,
      );

    // Add scene to ownedScenes for renderers with explicit ownership
    const ownedScenes = renderData.get("ownedScenes");
    if (ownedScenes !== null && ownedScenes !== undefined) {
      const ownedSceneEntry = new Y.Map();
      ownedSceneEntry.set("visible", true);
      ownedScenes.set(sceneId, ownedSceneEntry as ObjectToTypedMap<OwnedScene>);
    }
  } else {
    // Otherwise, this means that either the scene already exists
    // Or that we don't need to do anything if the plugin is also already there
    const rendererPlugins = renderData.get("children")?.get(sceneId);
    const currentRendererPluginIds = Array.from(rendererPlugins?.keys()!);
    const missingPlugins = sceneChildrenEntries.filter(
      ([pluginId]) => !currentRendererPluginIds.includes(pluginId),
    );

    if (missingPlugins.length > 0) {
      for (const [pluginId, pluginInfo] of missingPlugins) {
        const rendererPluginMap = new Y.Map();

        onRendererDataCreated({ pluginId, pluginInfo, rendererPluginMap });

        rendererPlugins?.set(
          pluginId,
          rendererPluginMap as ObjectToTypedMap<Record<string, any>>,
        );
      }
    }
  }
};

/**
 * Observes a Yjs state for plain JSON objects/arrays being inserted instead of Y.Map/Y.Array.
 * Only runs in development mode.
 * This helps detect programming errors where plain objects are accidentally inserted into Yjs.
 */

const checkForPlainJson = (value: unknown, path: string) => {
  if (value === null || value === undefined) return;
  if (typeof value !== "object") return;

  // Check if it's a Yjs type (Y.Map, Y.Array, Y.Text, etc.)
  if (value instanceof Y.AbstractType) return;

  // It's a plain object or array - log a warning
  const isArray = Array.isArray(value);
  console.warn(
    `[YjsState] Plain ${isArray ? "Array" : "JSON object"} detected instead of ${isArray ? "Y.Array" : "Y.Map"}. In most cases, this is unintended and will lead to hard to debug bugs.`,
    {
      path,
      value,
      hint: `Use ${isArray ? "new Y.Array()" : "new Y.Map()"} instead of plain ${isArray ? "[]" : "{}"}`,
    },
  );
  console.trace("Stack trace for plain JSON insertion:");
};
const observeForPlainJson = (state: YState) => {
  if (process.env.NODE_ENV !== "development") return;

  state.observeDeep((events) => {
    for (const event of events) {
      const path = event.path.join(".");

      // Check for map changes (keys)
      if (event.keys) {
        event.keys.forEach((change, key) => {
          if (change.action === "add" || change.action === "update") {
            const value = (event.target as Y.Map<any>).get(key);
            checkForPlainJson(value, path ? `${path}.${key}` : key);
          }
        });
      }

      // Check for array changes (delta)
      if (event.delta) {
        for (const delta of event.delta) {
          if (delta.insert && Array.isArray(delta.insert)) {
            delta.insert.forEach((value, index) => {
              checkForPlainJson(value, `${path}[${index}]`);
            });
          }
        }
      }
    }
  });
};

/**
 * This function should be called when the Yjs document is loaded
 * This handles everything from calling the plugin hooks to doing any operation we need to it
 */
const handleYjsDocumentLoad = ({
  document,
  documentName,
  state,
  serverPluginApi,
  disposableDocumentManager,
  organizationId,
  projectId,
  onPluginDeleted,
}: {
  document: Y.Doc;
  documentName: string;
  state: YState;
  serverPluginApi: ServerPluginApiPrivate;
  disposableDocumentManager: DisposableDocumentManager;
  organizationId: string;
  projectId: string;
  onPluginDeleted: (pluginId: string) => void;
}) => {
  const callPluginHooks = <
    T extends {
      pluginName: string;
      callback: (...args: any) => any;
    }[],
  >({
    registeredHooks,
    hookName,
    pluginInfo,
    callbackProps,
  }: {
    registeredHooks: T;
    hookName: string;
    pluginInfo: ObjectToTypedMap<Plugin>;
    callbackProps: Parameters<T[number]["callback"]>;
  }) => {
    try {
      disposableDocumentManager
        .getDocumentDisposable(documentName)
        .push(
          registeredHooks
            .find((x) => x.pluginName === pluginInfo.get("plugin"))
            ?.callback(...callbackProps) ?? {},
        );
    } catch (e) {
      console.error(
        `Error: Error occurred while running the \`${hookName}\` function in ` +
          pluginInfo.get("plugin"),
      );
      console.error(e);
    }
  };

  /**
   * Now we can start hooking the data to our plugins
   */
  const dataMap = state.get("data");

  const registeredOnPluginDataCreated =
    serverPluginApi.getRegisteredOnPluginDataCreated();
  const registeredOnPluginDataLoaded =
    serverPluginApi.getRegisteredOnPluginDataLoaded();
  const registeredOnRendererDataCreated =
    serverPluginApi.getRegisteredOnRendererDataCreated();
  const registeredOnRendererDataLoaded =
    serverPluginApi.getRegisteredOnRendererDataLoaded();

  const registeredSceneVisibilityChangeEventHandler: {
    sceneId: string;
    pluginId: string;
    callback: (visible: boolean) => void;
  }[] = [];

  const handleScene = (
    scene: ObjectToTypedMap<Scene<Record<string, any>>>,
    sceneId: string,
    isJustCreated: boolean = false,
  ) => {
    state.get("renderer")?.forEach((renderData) => {
      document?.transact(() => {
        // Make sure that the scene & plugin is reflected in `renderer`
        YjsState.syncRenderDataForScene({
          renderData,
          scene,
          sceneId,
          onRendererDataCreated: ({
            pluginId,
            pluginInfo,
            rendererPluginMap,
          }) => {
            callPluginHooks({
              registeredHooks: registeredOnRendererDataCreated,
              hookName: "onRendererDataCreated",
              pluginInfo,
              callbackProps: [
                rendererPluginMap,
                {
                  pluginId,
                  sceneId,
                  organizationId,
                  projectId,
                },
              ],
            });
          },
        });
      });

      // Handle scene change on each renderer
      renderData.observe((ev) => {
        if (ev.keysChanged.has("currentScene")) {
          const previousScene = ev.changes.keys.get("currentScene")?.oldValue;
          const newScene = renderData.get("currentScene");

          registeredSceneVisibilityChangeEventHandler.forEach((handler) => {
            if (handler.sceneId === previousScene) {
              handler.callback(false);
            } else if (handler.sceneId === newScene) {
              handler.callback(true);
            }
          });
        }
      });

      // Handle renderer load
      const sceneChildrenEntries = Array.from(
        scene.get("children")?.entries()!,
      );
      for (const [pluginId, pluginInfo] of sceneChildrenEntries) {
        callPluginHooks({
          registeredHooks: registeredOnRendererDataLoaded,
          hookName: "onRendererDataLoaded",
          pluginInfo,
          callbackProps: [
            renderData.get("children")?.get(sceneId)?.get(pluginId),
            {
              pluginId,
              sceneId,
              organizationId,
              projectId,
            },
            {
              onSceneVisibilityChange: (callback) => {
                // Register callback
                registeredSceneVisibilityChangeEventHandler.push({
                  sceneId,
                  pluginId,
                  callback,
                });
              },
            },
          ],
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

    for (const [pluginId, pluginInfo] of children?.entries() ?? []) {
      const getRendererData = () => {
        const rendererDataForPlugin: Record<string, ObjectToTypedMap<any>> = {};
        state.get("renderer")?.forEach((renderData, rendererId) => {
          const pluginRendererData = renderData
            .get("children")
            ?.get(sceneId)
            ?.get(pluginId);
          if (pluginRendererData) {
            rendererDataForPlugin[rendererId] = pluginRendererData;
          }
        });
        return rendererDataForPlugin;
      };

      if (isJustCreated) {
        callPluginHooks({
          registeredHooks: registeredOnPluginDataCreated,
          hookName: "onPluginDataCreated",
          pluginInfo,
          callbackProps: [
            pluginInfo,
            {
              pluginId,
              sceneId,
              organizationId,
              projectId,
            },
            { getRendererData },
          ],
        });
      }
      callPluginHooks({
        registeredHooks: registeredOnPluginDataLoaded,
        hookName: "onPluginDataLoaded",
        pluginInfo,
        callbackProps: [
          pluginInfo,
          {
            pluginId,
            sceneId,
            organizationId,
            projectId,
          },
          {
            getRendererData,
          },
        ],
      });
    }
  };

  const handleSectionOrScene = (
    sectionOrScene: ObjectToTypedMap<any>,
    id: string,
    isJustCreated: boolean = false,
  ) => {
    if (sectionOrScene.get("type") === "section") {
      return;
    }

    const scene = sectionOrScene as ObjectToTypedMap<
      Scene<Record<string, any>>
    >;
    handleScene(scene, id, isJustCreated);
  };

  const handleDeleteScene = (
    deletedSceneOrSection: ObjectToTypedMap<any>,
    sceneOrSectionId: string,
  ) => {
    // Make sure that renderer only have the available scene
    state.get("renderer")?.forEach((renderData) => {
      const sceneKeys = Array.from(renderData.get("children")?.keys() ?? []);

      if (sceneKeys.includes(sceneOrSectionId)) {
        renderData.get("children")?.delete(sceneOrSectionId);
      }
    });

    // Handle deletion hook
    const deletedSceneChildren = deletedSceneOrSection._map
      .get("children")
      ?.content.getContent()[0] as ObjectToTypedMap<Scene["children"]>;
    const deletedPluginIds = Array.from(deletedSceneChildren._map.keys());

    // Callback
    deletedPluginIds.forEach(onPluginDeleted);
    // TODO: Call Plugin Hook

    // TODO: Remove listeners
  };

  // Initial load
  dataMap?.forEach((sectionOrScene, id) => {
    // We handle all scenes that exist
    handleSectionOrScene(sectionOrScene, id);
  });

  // Handle changes
  dataMap?.observe((event) => {
    event.keys.forEach((value, key) => {
      // Handle additional scenes
      if (value.action === "add") {
        const sectionOrScene = dataMap.get(key)!;

        handleSectionOrScene(sectionOrScene, key, true);
      } else if (value.action === "delete") {
        // And handle removal of existing scenes too
        handleDeleteScene(value.oldValue, key);
      }
    });
  });

  // Handle when new renderers are added
  const handleNewRenderer = (
    renderData: ObjectToTypedMap<RenderData>,
    _rendererId: string,
  ) => {
    // Go through all existing scenes and set up render data for this new renderer
    dataMap?.forEach((sectionOrScene_, sceneId) => {
      const sectionOrScene = sectionOrScene_ as ObjectToTypedMap<any>;
      if (sectionOrScene.get("type") === "section") {
        return;
      }

      const scene = sectionOrScene as ObjectToTypedMap<
        Scene<Record<string, any>>
      >;

      document?.transact(() => {
        // Make sure that the scene & plugin is reflected in `renderer`
        YjsState.syncRenderDataForScene({
          renderData,
          scene,
          sceneId,
          onRendererDataCreated: ({
            pluginId,
            pluginInfo,
            rendererPluginMap,
          }) => {
            callPluginHooks({
              registeredHooks: registeredOnRendererDataCreated,
              hookName: "onRendererDataCreated",
              pluginInfo,
              callbackProps: [
                rendererPluginMap,
                {
                  pluginId,
                  sceneId,
                  organizationId,
                  projectId,
                },
              ],
            });
          },
        });
      });

      // Handle scene change on this renderer
      renderData.observe((ev) => {
        if (ev.keysChanged.has("currentScene")) {
          const previousScene = ev.changes.keys.get("currentScene")?.oldValue;
          const newScene = renderData.get("currentScene");

          registeredSceneVisibilityChangeEventHandler.forEach((handler) => {
            if (handler.sceneId === previousScene) {
              handler.callback(false);
            } else if (handler.sceneId === newScene) {
              handler.callback(true);
            }
          });
        }
      });

      // Handle renderer load for all plugins in this scene
      const sceneChildrenEntries = Array.from(
        scene.get("children")?.entries()!,
      );
      for (const [pluginId, pluginInfo] of sceneChildrenEntries) {
        callPluginHooks({
          registeredHooks: registeredOnRendererDataLoaded,
          hookName: "onRendererDataLoaded",
          pluginInfo,
          callbackProps: [
            renderData.get("children")?.get(sceneId)?.get(pluginId),
            {
              pluginId,
              sceneId,
              organizationId,
              projectId,
            },
            {
              onSceneVisibilityChange: (callback) => {
                // Register callback
                registeredSceneVisibilityChangeEventHandler.push({
                  sceneId,
                  pluginId,
                  callback,
                });
              },
            },
          ],
        });
      }
    });
  };

  // Observe for new renderers being added
  state.get("renderer")?.observe((event) => {
    event.keys.forEach((value, rendererId) => {
      if (value.action === "add") {
        const renderData = state.get("renderer")?.get(rendererId);
        if (renderData) {
          handleNewRenderer(renderData, rendererId);
        }
      }
    });
  });

  // TODO: Need to handle multiple plugin in 1 scene (adding, removing)

  // Monitor for plain JSON insertions in development mode
  observeForPlainJson(state);
};

export const YjsState = {
  createEmptyState,
  syncRenderDataForScene,
  handleYjsDocumentLoad,
};
