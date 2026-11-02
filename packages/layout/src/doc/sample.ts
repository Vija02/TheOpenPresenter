import type { PluginSample } from "@repo/base-types";

import type { LookTarget } from "./look";

/** Where a plugin's sample sits, in the project of its own it shows in */
export const SAMPLE_TARGET: LookTarget = {
  rendererId: "sample",
  sceneId: "sample-scene",
  pluginId: "sample-plugin",
};

/**
 * A project of its own, as plain JSON: one scene holding the plugin's sample,
 * live on its one renderer
 */
export const sampleProjectState = (
  pluginName: string,
  sample: PluginSample,
) => {
  const { rendererId, sceneId, pluginId } = SAMPLE_TARGET;
  return {
    data: {
      [sceneId]: {
        name: "Sample",
        type: "scene",
        order: 0,
        children: {
          [pluginId]: {
            plugin: pluginName,
            order: 0,
            pluginData: sample.pluginData ?? {},
          },
        },
      },
    },
    renderer: {
      [rendererId]: {
        currentScene: sceneId,
        overlay: null,
        ownedScenes: null,
        layout: null,
        children: { [sceneId]: { [pluginId]: sample.rendererData ?? {} } },
      },
    },
  };
};
