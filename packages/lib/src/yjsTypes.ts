import type { Document } from "@hocuspocus/server";
import {
  TypedArray as TypedArrayRaw,
  TypedMap as TypedMapRaw,
} from "yjs-types";

export interface TypedArray<T> extends TypedArrayRaw<T> {
  doc: Document | null;
}
export interface TypedMap<Data extends Record<string, unknown>>
  extends TypedMapRaw<Data> {
  doc: Document | null;
}

export type ObjectToTypedMap<T> = T extends null | undefined
  ? T
  : T extends Array<infer Item>
    ? TypedArray<ObjectToTypedMap<Item>[]>
    : T extends Record<any, any>
      ? TypedMap<{
          [K in keyof T]: ObjectToTypedMap<T[K]>;
        }>
      : T;

export interface IDisposable {
  dispose?(): void;
}
