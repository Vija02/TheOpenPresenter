import { logger } from "@repo/observability";
import { toast } from "react-toastify";
import { Awareness } from "y-protocols/awareness.js";
import { Doc } from "yjs";
import { createStore } from "zustand";

import {
  AwarenessContext,
  MiscProps,
  PluginContext,
  staticOutputVolume,
} from "..";
import { initPluginApi } from "./initPluginApi";

const unavailable = (what: string) => () =>
  Promise.reject(new Error(`${what} is not available outside a plugin`));

const inertMisc = (): MiscProps => ({
  setAwarenessStateData: () => {},
  triggerKeyPress: () => {},
  zoomLevel: createStore(() => ({ zoomLevel: 1, setZoomLevel: () => {} })),
  errorHandler: { addError: () => {}, removeError: () => {} },
  canPlayAudio: {
    value: false,
    _rawValue: false,
    isChecking: false,
    subscribe: () => () => {},
  },
  outputVolume: staticOutputVolume,
  overlay: { getType: () => null, subscribe: () => () => {} },
  currentScene: { get: () => null, subscribe: () => () => {} },
  toast,
  media: {
    permanentlyDeleteMedia: unavailable("Deleting media"),
    completeMedia: unavailable("Completing media"),
    unlinkMediaFromPlugin: unavailable("Unlinking media"),
  },
  mediaPicker: { show: unavailable("The media picker") },
  logger,
  parentContainer: null,
  surface: "renderer",
  derivation: null,
  isPublicAccess: false,
  organizationType: null,
  experimentalFeaturesEnabled: false,
});

/** A plugin API for content drawn outside any plugin */
export const initStandalonePluginApi = ({
  pluginContext,
  misc,
}: {
  pluginContext: PluginContext;
  misc?: Partial<MiscProps>;
}) => {
  // Detached doc since it's not part of a plugin
  const doc = new Doc();

  const awarenessContext: AwarenessContext = {
    awarenessObj: new Awareness(doc),
    currentUserId: "",
  };

  return initPluginApi({
    yjsPluginSceneData: doc.getMap("scene") as any,
    yjsPluginRendererData: doc.getMap("renderer") as any,
    awarenessContext,
    pluginContext,
    setRenderCurrentScene: () => {},
    misc: { ...inertMisc(), ...misc },
  });
};
