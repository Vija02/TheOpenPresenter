import { TypedMap } from "yjs-types";

export type UUID = string;

export type ObjectToTypedMap<T> = T extends object
  ? TypedMap<{
      [K in keyof T]: T[K] extends Record<any, any>
        ? ObjectToTypedMap<T[K]>
        : T[K];
    }>
  : T;

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
  children: Record<UUID, Record<UUID, T>>;
};

export type PluginContext = {
  pluginId: UUID;
  sceneId: UUID;
};

export const keyPressTypes = ["PREV", "NEXT"] as const;
export type KeyPressType = (typeof keyPressTypes)[number];

export interface IDisposable {
  dispose?(): void;
}
