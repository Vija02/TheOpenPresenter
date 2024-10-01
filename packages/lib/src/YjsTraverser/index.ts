import { AbstractType } from "yjs";

import { ObjectToTypedMap } from "../yjsTypes";

// TODO: Infer type from yData
export function createTraverser<T = any>(yData: any) {
  if (!(yData instanceof AbstractType)) {
    // We have the option to return the value.
    // But in this case, it's probably an error so we better just throw the error
    throw new Error(
      "Error: Invalid value passed to traverser. Traverser only accepts valid yjs object.",
    );
  }
  return function traverser<Y extends (x: T) => any>(
    traverseFunction?: Y,
  ): ObjectToTypedMap<ReturnType<Y>> {
    if (!traverseFunction) return yData as any;

    const originalValue = Symbol("originalValue");
    const isProxy = Symbol("isProxy");

    const handler = {
      get(target: any, key: any): any {
        if (key === originalValue) {
          return target;
        }
        if (key === isProxy) {
          return true;
        }

        const newTarget = target.get(key);
        // If not an yjs object, return it as it is
        if (
          !newTarget ||
          typeof newTarget !== "object" ||
          !("doc" in newTarget)
        ) {
          return newTarget;
        }

        return new Proxy(newTarget, handler);
      },
    };

    const proxy = new Proxy(yData, handler);

    const traversed = traverseFunction(proxy);

    if (typeof traversed === "object" && traversed?.[isProxy]) {
      return traversed[originalValue];
    }

    const unwrap = (value: any): any => {
      if (value === null) {
        return null;
      } else if (value === undefined) {
        return undefined;
      } else if (typeof value === "object") {
        // If it's proxy, just return the originalValue
        if (value?.[isProxy]) {
          return value[originalValue];
        }
        // Don't unwrap yjs objects. This will lead to infinite recursive
        else if ("doc" in value) {
          return value;
        }
        // Otherwise, we can unwrap the object
        else if (Array.isArray(value)) {
          return value.map((val) => unwrap(val));
        } else {
          return Object.fromEntries(
            Object.entries(value).map(([key, val]) => [key, unwrap(val)]),
          );
        }
      } else {
        return value;
      }
    };

    return unwrap(traversed);
  };
}
