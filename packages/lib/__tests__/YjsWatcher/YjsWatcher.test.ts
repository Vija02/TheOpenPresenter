import { expect, test, vi } from "vitest";
import * as Y from "yjs";

import { YjsWatcher } from "../../src";
import { MapType, getYDoc } from "../helpers";

const getBasicSetup = () => {
  const doc = getYDoc();
  const map = doc.getMap("map");

  const yjsWatcher = new YjsWatcher(map);

  return {
    map,
    yjsWatcher,
    watchYjsDataTyped<Y = any>(fn?: (x: MapType) => Y, callback?: () => void) {
      return yjsWatcher.watchYjsData<Y>(fn, callback);
    },
  };
};

test("tracks primitive changes", async () => {
  const { map, watchYjsDataTyped } = getBasicSetup();

  const cbFn1 = vi.fn(() => {});
  watchYjsDataTyped((x) => x.number, cbFn1);
  const cbFn2 = vi.fn(() => {});
  watchYjsDataTyped((x) => x.bool, cbFn2);
  const cbFn3 = vi.fn(() => {});
  watchYjsDataTyped((x) => x.null, cbFn3);
  const cbFn4 = vi.fn(() => {});
  watchYjsDataTyped((x) => x.nothing, cbFn4);

  // ACTION
  map.set("number", 200);
  map.set("bool", 200);
  map.set("null", 200);
  map.set("nothing", 200);

  // TEST
  expect(cbFn1).toBeCalledTimes(1);
  expect(cbFn2).toBeCalledTimes(1);
  expect(cbFn3).toBeCalledTimes(1);
  expect(cbFn4).toBeCalledTimes(1);
});

test("tracks primitive changes (with base path)", async () => {
  const doc = getYDoc();
  const map = doc.getMap("map");

  const childMap = new Y.Map();
  map.set("child", childMap);

  const yjsWatcher = new YjsWatcher(childMap);

  function watchYjsDataTyped<Y = any>(
    fn?: (x: MapType) => Y,
    callback?: () => void,
  ) {
    return yjsWatcher.watchYjsData<Y>(fn, callback);
  }

  const cbFn1 = vi.fn(() => {});
  watchYjsDataTyped((x) => x.number, cbFn1);
  const cbFn2 = vi.fn(() => {});
  watchYjsDataTyped((x) => x.bool, cbFn2);
  const cbFn3 = vi.fn(() => {});
  watchYjsDataTyped((x) => x.null, cbFn3);
  const cbFn4 = vi.fn(() => {});
  watchYjsDataTyped((x) => x.nothing, cbFn4);

  // ACTION
  childMap.set("number", 200);
  childMap.set("bool", 200);
  childMap.set("null", 200);
  childMap.set("nothing", 200);

  childMap.set("number", 400);

  // TEST
  expect(cbFn1).toBeCalledTimes(2);
  expect(cbFn2).toBeCalledTimes(1);
  expect(cbFn3).toBeCalledTimes(1);
  expect(cbFn4).toBeCalledTimes(1);
});

test("tracks when parent is changed", async () => {
  const { map, watchYjsDataTyped } = getBasicSetup();

  const cbFn1 = vi.fn(() => {});
  watchYjsDataTyped((x) => x.nestedArray[1], cbFn1);

  // ACTION
  map.set("nestedArray", "Hello");
  map.set("nestedMap", "Hello");

  // TEST
  expect(cbFn1).toBeCalledTimes(1);
});

test("tracks when children is changed", async () => {
  const { map, watchYjsDataTyped } = getBasicSetup();

  const cbFn1 = vi.fn(() => {});
  watchYjsDataTyped((x) => x.nestedArray, cbFn1);

  // ACTION
  (map.get("nestedArray") as Y.Array<any>).get(0).push([1]);
  (map.get("nestedArray") as Y.Array<any>).get(0).push([1, 2]);

  // TEST
  expect(cbFn1).toBeCalledTimes(2);
});

test("tracks when object changed in transaction", async () => {
  const { map, watchYjsDataTyped } = getBasicSetup();

  const cbFn1 = vi.fn(() => {});
  watchYjsDataTyped((x) => x.nothing, cbFn1);
  const cbFn2 = vi.fn(() => {});
  watchYjsDataTyped((x) => x.number, cbFn2);
  const cbFn3 = vi.fn(() => {});
  watchYjsDataTyped((x) => x.emptyObject, cbFn3);
  const cbFn4 = vi.fn(() => {});
  watchYjsDataTyped((x) => x.nestedMap, cbFn4);
  const cbFn5 = vi.fn(() => {});
  watchYjsDataTyped((x) => x.nestedMap.nestedMapAgain, cbFn5);
  const cbFn6 = vi.fn(() => {});
  watchYjsDataTyped((x) => x.nestedMap.nestedMapAgain.nestedValue, cbFn6);

  // ACTION
  map.doc?.transact(() => {
    map.set("number", 300);
    map.set("emptyObject", new Y.Map());
    (map.get("nestedMap") as Y.Map<any>)
      .get("nestedMapAgain")
      .set("nestedValue", "Changed");
  });

  // TEST
  expect(cbFn1).toBeCalledTimes(0);
  expect(cbFn2).toBeCalledTimes(1);
  expect(cbFn3).toBeCalledTimes(1);
  expect(cbFn4).toBeCalledTimes(1);
  expect(cbFn5).toBeCalledTimes(1);
  expect(cbFn6).toBeCalledTimes(1);
});

test("tracks when object changed immutably", async () => {
  const { map, watchYjsDataTyped } = getBasicSetup();

  const cbFn1 = vi.fn(() => {});
  watchYjsDataTyped((x) => x.nestedMap.nestedMapAgain.nestedValue, cbFn1);

  // ACTION
  const newMap = new Y.Map();
  newMap.set("nestedValue", "Hi");
  (map.get("nestedMap") as Y.Map<any>).set("nestedMapAgain", newMap);

  // TEST
  expect(cbFn1).toBeCalledTimes(1);
});

test("stops tracking when cleaned up", async () => {
  const { map, watchYjsDataTyped } = getBasicSetup();

  const cbFn1 = vi.fn(() => {});
  const stopWatching = watchYjsDataTyped((x) => x.number, cbFn1);

  // SETUP & TEST
  map.set("number", 200);

  expect(cbFn1).toBeCalledTimes(1);

  map.set("number", 900);
  map.set("bool", false);

  expect(cbFn1).toBeCalledTimes(2);

  stopWatching();

  map.set("number", 200);

  expect(cbFn1).toBeCalledTimes(2);
});
