import { useCallback, useEffect, useRef } from "react";

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

/**
 * Looks change on the server, from this remote or anywhere else. Once the
 * scene's copy arrives, keep the live run on the background it now resolves to
 */
export const useFollowLookChanges = () => {
  const pluginApi = usePluginAPI();
  const looks = pluginApi.scene.useData((x) => x.pluginData.looks);
  const { reactivateLive } = useActivateLyricSlide();

  const reactivateRef = useRef(reactivateLive);
  reactivateRef.current = reactivateLive;

  useEffect(() => {
    reactivateRef.current();
  }, [looks]);
};
