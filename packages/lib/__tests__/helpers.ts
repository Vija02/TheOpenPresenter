import * as Y from "yjs";

export type MapType = {
  nothing?: undefined;
  null: null;
  number: number;
  string: string;
  bool: boolean;
  emptyArray: any[];
  emptyObject: Record<string, any>;
  primitiveArray: any[];
  primitiveMap: Record<string, any>;
  nestedArray: [any[], { nestedValue: string }];
  nestedMap: { nestedArray: number[]; nestedMapAgain: { nestedValue: string } };
};

export const getYDoc = () => {
  const doc = new Y.Doc();
  const map = doc.getMap("map");
  map.set("null", null);
  map.set("number", 100);
  map.set("string", "Hello World");
  map.set("bool", true);
  map.set("emptyArray", new Y.Array());
  map.set("emptyObject", new Y.Map());

  const primitiveArray = new Y.Array<any>();
  primitiveArray.push([1, 999, "Hello", true, false, null]);
  map.set("primitiveArray", primitiveArray);

  const primitiveMap = new Y.Map<any>();
  primitiveMap.set("number", 999);
  primitiveMap.set("string", "Hello Primitive");
  primitiveMap.set("bool", true);
  map.set("primitiveMap", primitiveMap);

  const nestedArray = new Y.Array<any>();
  const m = new Y.Map();
  m.set("nestedValue", "Nested");
  nestedArray.push([new Y.Array<any>(), m]);
  map.set("nestedArray", nestedArray);

  const nestedMap = new Y.Map<any>();
  const a = new Y.Array();
  a.push([1]);
  const b = new Y.Map();
  b.set("nestedValue", "Nested");
  nestedMap.set("nestedArray", a);
  nestedMap.set("nestedMapAgain", b);
  map.set("nestedMap", nestedMap);

  return doc;
};
