import type { MediaPicker, PluginContext, UUID } from "@repo/base-types";
import type { OrganizationType } from "@repo/graphql";
import type { ObjectToTypedMap } from "@repo/lib";
import type { Logger } from "pino";
import type { toast as ReactToast } from "react-toastify";
import type { IResult } from "ua-parser-js";
import type { Awareness } from "y-protocols/awareness.js";
import type { StoreApi } from "zustand";

import { DerivationConfig, RendererLayout } from "./rendererLayoutTypes";

export type { ObjectToTypedMap };

export type { UUID };

export type YState = ObjectToTypedMap<State>;

export type State = {
  meta: Meta;
  data: StateData;
  renderer: Renderer;
};

export type Meta = {
  id: UUID;
  name: string;
  createdAt: string;
};

export type StateData = Record<UUID, Section | Scene>;

export type Section = {
  name: string;
  type: "section";
  order: number;
};

export type Scene<T = Record<string, any>> = {
  name: string;
  type: "scene";
  order: number;
  children: Record<UUID, Plugin<T>>;
};

export type Plugin<T = Record<string, any>> = {
  plugin: string;
  order: number;
  pluginData: T;
};

export type Renderer = Record<string, RenderData>;

export type OwnedScene = {
  visible: boolean;
};

export type RenderData<T = Record<string, any>> = {
  currentScene: UUID | null;
  overlay: { type: "black" | "white" | "clear" } | null;
  children: Record<UUID, Record<UUID, T>>;
  ownedScenes: Record<UUID, OwnedScene> | null;
  layout: RendererLayout | null;
};

export type PluginRendererState = {
  __audioIsPlaying?: boolean;
  __audioIsRecording?: boolean;
};

export type { PluginContext };

export const keyPressTypes = ["PREV", "NEXT"] as const;
export type KeyPressType = (typeof keyPressTypes)[number];

export interface IDisposable {
  dispose?(): void;
}

// ========================================================================== //
// ================================ Awareness =============================== //
// ========================================================================== //
export type AwarenessContext = {
  awarenessObj: Awareness;
  currentUserId: string;
};

// Extra state about the client
export type AwarenessStateContext = {
  pluginId: string;
  sceneId: string;
};
export type AwarenessStateData = {
  isLoading?: boolean;
  isError?: boolean;
};
export type AwarenessState = (AwarenessStateContext & AwarenessStateData)[];

export type AwarenessStore<T extends object = {}> = T & {
  user: AwarenessUserData;
};
export type AwarenessUserData = {
  id: string;
  type: "remote" | "renderer";
  userAgentInfo: IResult;
  errors: string[];
  state: AwarenessState;
};

// ========================================================================== //
// ================================== Misc ================================== //
// ========================================================================== //
export type MiscProps = {
  setAwarenessStateData: (state: AwarenessStateData) => void;
  triggerKeyPress: (keyType: KeyPressType, sceneId?: string) => void;
  zoomLevel: ZoomLevel;
  errorHandler: ErrorHandler;
  canPlayAudio: CanPlayAudio;
  outputVolume: OutputVolume;
  overlay: OverlayInfo;
  currentScene: CurrentSceneInfo;
  toast: typeof ReactToast;
  media: MediaHandler;
  mediaPicker: MediaPicker;
  logger: Logger;
  parentContainer: HTMLElement | null;
  derivation?: DerivationConfig | null;
  isPublicAccess: boolean;
  organizationType: OrganizationType | null;
  experimentalFeaturesEnabled: boolean;
};

export type WebComponentProps<TrpcClient> = {
  yjsPluginSceneData: ObjectToTypedMap<Plugin<any>>;
  yjsPluginRendererData: ObjectToTypedMap<any>;
  awarenessContext: AwarenessContext;
  pluginContext: PluginContext;
  setRenderCurrentScene: () => void;
  trpcClient: TrpcClient;
  misc: MiscProps;
};

export const sceneCategories = ["Display", "Media", "Audio"] as const;
export type SceneCategories = (typeof sceneCategories)[number];

export type CanPlayAudio = {
  value: boolean;
  _rawValue: boolean;
  isChecking: boolean;
  subscribe: (callback: () => void) => () => void;
};

// Multiplier for volume. All audio should go through this
export type OutputVolume = {
  scale: number;
  subscribe: (callback: () => void) => () => void;
};

export const staticOutputVolume: OutputVolume = {
  scale: 1,
  subscribe: () => () => {},
};

export type OverlayType = "black" | "white" | "clear" | null;

export type OverlayInfo = {
  getType: () => OverlayType;
  subscribe: (callback: () => void) => () => void;
};

export type CurrentSceneInfo = {
  get: () => string | null;
  subscribe: (callback: () => void) => () => void;
};

export type ErrorHandler = {
  addError: (code: string) => void;
  removeError: (code: string) => void;
};

export type ZoomLevelState = {
  zoomLevel: number;
  setZoomLevel: (val: number) => void;
};
export type ZoomLevel = StoreApi<ZoomLevelState>;

export type MediaHandler = {
  // Debt: any type
  permanentlyDeleteMedia: (mediaKey: string) => Promise<any>;
  completeMedia: (mediaKey: string) => Promise<any>;
  unlinkMediaFromPlugin: (mediaKey: string | null) => Promise<any>;
};

export type {
  MediaPickerOptions,
  MediaPickerOptionsInternal,
  MediaPickerResult,
  MediaType,
} from "@repo/base-types";
export type { MediaPicker };
