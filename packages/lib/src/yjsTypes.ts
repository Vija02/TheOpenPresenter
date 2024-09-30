import type { Document } from "@hocuspocus/server";
import {
  TypedArray as TypedArrayRaw,
  TypedMap as TypedMapRaw,
} from "yjs-types";

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

export interface IDisposable {
  dispose?(): void;
}
