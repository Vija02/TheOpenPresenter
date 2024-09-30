import { expect, test } from "vitest";
import * as Y from "yjs";

import { createTraverser } from "../src";
import { MapType, getYDoc } from "./helpers";

test("returns primitive value", async () => {
  const doc = getYDoc();
  const map = doc.getMap("map");

  const traverser = createTraverser<MapType>(map);

  const number = traverser((x) => x.number);
  const string = traverser((x) => x.string);
  const bool = traverser((x) => x.bool);

  expect(number).toEqual(100);
  expect(string).toEqual("Hello World");
  expect(bool).toEqual(true);
});

test("returns undefined if doesn't exist", async () => {
  const doc = getYDoc();
  const map = doc.getMap("map");

  const traverser = createTraverser<MapType>(map);

  const nothing = traverser((x) => x.nothing);

  expect(nothing).toEqual(undefined);
});

test("returns null value properly", async () => {
  const doc = getYDoc();
  const map = doc.getMap("map");

  const traverser = createTraverser<MapType>(map);

  const nullVal = traverser((x) => x.null);

  expect(nullVal).toEqual(null);
});

test("returns yjs object reference", async () => {
  const doc = getYDoc();
  const map = doc.getMap("map");

  const traverser = createTraverser<MapType>(map);

  const emptyArray = traverser((x) => x.emptyArray);
  const emptyObject = traverser((x) => x.emptyObject);
  const primitiveArray = traverser((x) => x.primitiveArray);
  const primitiveMap = traverser((x) => x.primitiveMap);

  expect(emptyArray).toEqual(map.get("emptyArray"));
  expect(emptyObject).toEqual(map.get("emptyObject"));
  expect(primitiveArray).toEqual(map.get("primitiveArray"));
  expect(primitiveMap).toEqual(map.get("primitiveMap"));
});

test("returns yjs nested object", async () => {
  const doc = getYDoc();
  const map = doc.getMap("map");

  const traverser = createTraverser<MapType>(map);

  const nestedMap = traverser((x) => x.nestedMap);
  const nestedArray = traverser((x) => x.nestedArray);

  expect(nestedMap).toEqual(map.get("nestedMap"));
  expect(nestedArray).toEqual(map.get("nestedArray"));
});

test("returns yjs nested object nested", async () => {
  const doc = getYDoc();
  const map = doc.getMap("map");

  const traverser = createTraverser<MapType>(map);

  const doubleNestedMap = traverser((x) => x.nestedMap.nestedMapAgain);
  const doubleNestedArray = traverser((x) => x.nestedArray[0]);

  expect(doubleNestedMap).toEqual(
    (map.get("nestedMap") as Y.Map<any>).get("nestedMapAgain"),
  );
  expect(doubleNestedArray).toEqual(
    (map.get("nestedArray") as Y.Array<any>).get(0),
  );
});

test("returns yjs nested primitive", async () => {
  const doc = getYDoc();
  const map = doc.getMap("map");

  const traverser = createTraverser<MapType>(map);

  const nestedPrimitive = traverser(
    (x) => x.nestedMap.nestedMapAgain.nestedValue,
  );

  expect(nestedPrimitive).toEqual("Nested");
});

test("returns primitive when accessing array index", async () => {
  const doc = getYDoc();
  const map = doc.getMap("map");

  const traverser = createTraverser<MapType>(map);

  const primitiveArrayIndex0 = traverser((x) => x.primitiveArray[0]);
  const primitiveArrayIndex1 = traverser((x) => x.primitiveArray[1]);
  const primitiveArrayIndex2 = traverser((x) => x.primitiveArray[2]);
  const primitiveArrayIndex3 = traverser((x) => x.primitiveArray[3]);
  const primitiveArrayIndex4 = traverser((x) => x.primitiveArray[4]);
  const primitiveArrayIndex5 = traverser((x) => x.primitiveArray[5]);
  const primitiveArrayIndex6 = traverser((x) => x.primitiveArray[6]);

  expect(primitiveArrayIndex0).toEqual(1);
  expect(primitiveArrayIndex1).toEqual(999);
  expect(primitiveArrayIndex2).toEqual("Hello");
  expect(primitiveArrayIndex3).toEqual(true);
  expect(primitiveArrayIndex4).toEqual(false);
  expect(primitiveArrayIndex5).toEqual(null);
  expect(primitiveArrayIndex6).toEqual(undefined);
});

test("returns value mapped", async () => {
  const doc = getYDoc();
  const map = doc.getMap("map");

  const traverser = createTraverser<MapType>(map);

  const obj = { hello: "world" };
  const arr = [1, 2, 3];

  const primitive = traverser(() => 1);
  const object = traverser(() => obj);
  const array = traverser(() => arr);

  expect(primitive).toEqual(1);
  expect(object).toEqual(obj);
  expect(array).toEqual(arr);
});

test("returns primitive mapped", async () => {
  const doc = getYDoc();
  const map = doc.getMap("map");

  const traverser = createTraverser<MapType>(map);

  const res = traverser((x) => ({
    number: x.number,
    string: x.string,
    nothing: x.nothing,
    null: x.null,
  }));

  expect(res).toEqual({
    number: 100,
    string: "Hello World",
    nothing: undefined,
    null: null,
  });
});

test("returns primitive mapped(array)", async () => {
  const doc = getYDoc();
  const map = doc.getMap("map");

  const traverser = createTraverser<MapType>(map);

  const res = traverser((x) => [x.number, x.string, x.nothing, x.null]);

  expect(res).toEqual([100, "Hello World", undefined, null]);
});

test("returns nested mapped", async () => {
  const doc = getYDoc();
  const map = doc.getMap("map");

  const traverser = createTraverser<MapType>(map);

  const res = traverser((x) => ({
    nestedMap: x.nestedMap,
    somethingInside: x.nestedArray[1],
    somethingPrimitive: x.primitiveMap.number,
  }));

  expect(res).toEqual({
    nestedMap: map.get("nestedMap"),
    somethingInside: (map.get("nestedArray") as Y.Array<any>).get(1),
    somethingPrimitive: 999,
  });
});

test("returns original value if no fn passed", async () => {
  const doc = getYDoc();
  const map = doc.getMap("map");

  const traverser = createTraverser<MapType>(map);

  const res = traverser();

  expect(res).toEqual(map);
});
