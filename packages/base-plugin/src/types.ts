import { ObjectToTypedMap } from "@repo/lib";
import type { Logger } from "pino";
import { toast as ReactToast } from "react-toastify";
import UAParser from "ua-parser-js";
import * as awarenessProtocol from "y-protocols/awareness.js";
import { StoreApi } from "zustand";

export type { ObjectToTypedMap };

export type UUID = string;

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

export type RenderData<T = Record<string, any>> = {
  currentScene: UUID | null;
  overlay: { type: "black" | "white" } | null;
  children: Record<UUID, Record<UUID, T>>;
};

export type PluginRendererState = {
  __audioIsPlaying?: boolean;
  __audioIsRecording?: boolean;
};

export type PluginContext = {
  pluginId: UUID;
  sceneId: UUID;
  organizationId: UUID;
};

export const keyPressTypes = ["PREV", "NEXT"] as const;
export type KeyPressType = (typeof keyPressTypes)[number];

export interface IDisposable {
  dispose?(): void;
}

// ========================================================================== //
// ================================ Awareness =============================== //
// ========================================================================== //
export type AwarenessContext = {
  awarenessObj: awarenessProtocol.Awareness;
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
  userAgentInfo: UAParser.IResult;
  errors: string[];
  state: AwarenessState;
};

// ========================================================================== //
// ================================== Misc ================================== //
// ========================================================================== //
export type MiscProps = {
  setAwarenessStateData: (state: AwarenessStateData) => void;
  zoomLevel: ZoomLevel;
  errorHandler: ErrorHandler;
  canPlayAudio: CanPlayAudio;
  toast: typeof ReactToast;
  media: MediaHandler;
  logger: Logger;
  parentContainer: HTMLElement | null;
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
  deleteMedia: (id: string) => Promise<any>;
  completeMedia: (id: string) => Promise<any>;
};
