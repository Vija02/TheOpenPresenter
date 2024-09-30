export function pathTraverser(traverseFunction?: (x: any) => any): string[] {
  if (!traverseFunction) return [""];

  const originalValue = Symbol("originalValue");
  const isProxy = Symbol("isProxy");

  const proxied: any = [];

  const handler = {
    get(target: any, key: any): any {
      if (key === originalValue) {
        proxied.push(target.join("__"));
        return target;
      }
      if (key === isProxy) {
        return true;
      }

      return new Proxy([...target, key], handler);
    },
  };

  const proxy = new Proxy([], handler);

  const traversed = traverseFunction(proxy);

  if (typeof traversed === "object" && traversed?.[isProxy]) {
    return [traversed[originalValue].join("__")];
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

  unwrap(traversed);
  // console.log(proxied)
  return proxied;
  // return traversed;
}
