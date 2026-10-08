import { useCallback } from "react";

import {
  activateLyricSlide,
  valtioLyricsActivationTarget,
} from "../src/activation";
import { usePluginAPI } from "./pluginApi";

/** Every remote change to what lyrics shows goes through here */
export const useActivateLyricSlide = () => {
  const pluginApi = usePluginAPI();
  const mutableRendererData = pluginApi.renderer.useValtioData();
  const mutableSceneData = pluginApi.scene.useValtioData();

  const activate = useCallback(
    (songId: string | null, index: number | null) => {
      activateLyricSlide(
        valtioLyricsActivationTarget(mutableRendererData),
        mutableSceneData.pluginData,
        songId,
        index,
      );
    },
    [mutableRendererData, mutableSceneData],
  );

  /**
   * Call after editing songs or styles, so the run follows a background that
   * changed under the live slide
   */
  const reactivateLive = useCallback(() => {
    if (!mutableRendererData.songId) return;
    activate(mutableRendererData.songId, mutableRendererData.currentIndex);
  }, [activate, mutableRendererData]);

  return { activate, reactivateLive };
};
