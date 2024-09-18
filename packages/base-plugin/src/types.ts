import type { Document } from "@hocuspocus/server";
import UAParser from "ua-parser-js";
import * as awarenessProtocol from "y-protocols/awareness.js";
import {
  TypedArray as TypedArrayRaw,
  TypedMap as TypedMapRaw,
} from "yjs-types";

export type UUID = string;

interface TypedArray<T> extends TypedArrayRaw<T> {
  doc: Document | null;
}
interface TypedMap<Data extends Record<string, unknown>>
  extends TypedMapRaw<Data> {
  doc: Document | null;
}

export type ObjectToTypedMap<T> =
  T extends Array<any>
    ? TypedArray<T>
    : T extends Record<any, any>
      ? TypedMap<{
          [K in keyof T]: T[K] extends Array<any>
            ? TypedArray<T[K]>
            : T[K] extends Record<any, any>
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
  overlay: { type: "black" | "white" } | null;
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
};
