import { TypedMap } from "yjs-types";

export type UUID = string;

export type ObjectToTypedMap<T extends Record<any, any>> = TypedMap<{
  [K in keyof T]: T[K] extends Record<any, any> ? ObjectToTypedMap<T[K]> : T[K];
}>;

export type YState = ObjectToTypedMap<State>;

export type State = {
  meta: Meta;
  data: StateData;
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

export interface IDisposable {
  dispose?(): void;
}
