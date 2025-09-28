import { typeidUnboxed } from "typeid-js";
import { proxy } from "valtio";
import { bind } from "valtio-yjs";
import * as Y from "yjs";

import {
  ObjectToTypedMap,
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
}: {
  document: Y.Doc;
  documentName: string;
  state: YState;
  serverPluginApi: ServerPluginApiPrivate;
  disposableDocumentManager: DisposableDocumentManager;
  organizationId: string;
  projectId: string;
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
    sectionOrScene: ObjectToTypedMap<any>,
    id: string,
  ) => {
    if (sectionOrScene.get("type") === "section") {
      return;
    }
    const sceneId = id;

    // Make sure that renderer only have the available scene
    state.get("renderer")?.forEach((renderData) => {
      const sceneKeys = Array.from(renderData.get("children")?.keys() ?? []);

      if (sceneKeys.includes(sceneId)) {
        renderData.get("children")?.delete(sceneId);
      }
    });

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

  // TODO: Need to handle multiple plugin in 1 scene (adding, removing)
};

export const YjsState = {
  createEmptyState,
  syncRenderDataForScene,
  handleYjsDocumentLoad,
};
