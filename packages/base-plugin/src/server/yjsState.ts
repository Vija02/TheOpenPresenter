import { typeidUnboxed } from "typeid-js";
import { proxy } from "valtio";
import { bind } from "valtio-yjs";
import * as Y from "yjs";

import { ObjectToTypedMap, Plugin, RenderData, Scene, State } from "../types";

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

export const YjsState = {
  createEmptyState,
  syncRenderDataForScene,
};
