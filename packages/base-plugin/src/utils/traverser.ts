import { ObjectToTypedMap } from "../types";

// TODO: Infer type from yData
export function createTraverser<T = any>(yData: any) {
  return function traverser<Y extends (x: T) => any>(
    traverseFunction?: Y,
    returnClosestYjsObj = false,
  ): ObjectToTypedMap<ReturnType<Y>> {
    if (!traverseFunction) return yData;

    const originalValue = Symbol("originalValue");

    const handler = {
      get(target: any, key: any): any {
        if (key === originalValue) {
          return target;
        }

        const newTarget = target.get(key);
        // If not an yjs object, return it as it is
        if (
          !newTarget ||
          typeof newTarget !== "object" ||
          !("doc" in newTarget)
        ) {
          if (returnClosestYjsObj) {
            return { [originalValue]: target };
          }
          return { [originalValue]: newTarget };
        }

        return new Proxy(newTarget, handler);
      },
    };

    const proxy = new Proxy(yData, handler);

    return traverseFunction(proxy)[originalValue];
  };
}
