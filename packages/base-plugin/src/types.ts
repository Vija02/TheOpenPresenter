import { ObjectToTypedMap } from "@repo/lib";
import { toast as ReactToast } from "react-toastify";
import UAParser from "ua-parser-js";
import * as awarenessProtocol from "y-protocols/awareness.js";

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

export type AwarenessUserData = {
  id: string;
  type: "remote" | "renderer";
  userAgentInfo: UAParser.IResult;
  errors: string[];
};

// ========================================================================== //
// ================================== Misc ================================== //
// ========================================================================== //
export type WebComponentProps<TrpcClient> = {
  yjsPluginSceneData: ObjectToTypedMap<Plugin<any>>;
  yjsPluginRendererData: ObjectToTypedMap<any>;
  awarenessContext: AwarenessContext;
  pluginContext: PluginContext;
  setRenderCurrentScene: () => void;
  trpcClient: TrpcClient;
  misc: { canPlayAudio: CanPlayAudio; toast: typeof ReactToast };
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
