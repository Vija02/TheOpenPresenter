import { State } from "@repo/base-plugin";

export const deleteScene = (mainState: State, sceneId: string) => {
  delete mainState.data[sceneId];
  for (const renderer of Object.values(mainState.renderer)) {
    if (renderer?.currentScene === sceneId) {
      renderer.currentScene = null;
    }
  }
};
