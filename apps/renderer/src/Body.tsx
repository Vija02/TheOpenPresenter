import React from "react";

import { trpcClient } from "./trpc";
import {
  getYJSPluginRenderer,
  getYJSPluginRendererData,
  getYJSPluginSceneData,
  useData,
} from "./yjs";

export const Body = () => {
  const data = useData();

  const currentRenderer = data.renderer["1"];
  const currentScene = currentRenderer?.currentScene;
  if (!currentScene) {
    return;
  }

  return (
    <>
      {Object.keys(currentRenderer.children[currentScene] ?? {}).map(
        (pluginId) =>
          React.createElement("myworshiplist-renderer", {
            key: pluginId,
            yjsPluginSceneData: getYJSPluginSceneData(currentScene, pluginId),
            yjsPluginRendererData: getYJSPluginRendererData(
              currentScene,
              pluginId,
            ),
            setRenderCurrentScene: () => {
              getYJSPluginRenderer()?.set("currentScene", currentScene);
            },
            trpcClient,
          }),
      )}
    </>
  );
};
