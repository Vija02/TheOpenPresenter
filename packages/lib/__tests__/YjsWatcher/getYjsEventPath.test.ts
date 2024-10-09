import { expect, test } from "vitest";
import * as Y from "yjs";

import { getYjsEventPath } from "../../src/YjsWatcher/getYjsEventPath";
import { getYDoc } from "../helpers";

const getBasicSetup = () => {
  const doc = getYDoc();
  const map = doc.getMap("map");

  const eventPaths: any[] = [];

  map.observeDeep((events: Y.YEvent<any>[]) => {
    eventPaths.push(events.map(getYjsEventPath));
  });

  return {
    map,
    eventPaths,
  };
};

test("returns changes in basePath", async () => {
  const { map, eventPaths } = getBasicSetup();

  map.set("number", 300);
  map.set("emptyObject", new Y.Map());
  map.set("basePath", "");
  map.set("basePath2", "");

  expect(eventPaths).toEqual([
    [["number"]],
    [["emptyObject"]],
    [["basePath"]],
    [["basePath2"]],
  ]);
});

test("returns changes in basePath transaction", async () => {
  const { map, eventPaths } = getBasicSetup();

  map.doc?.transact(() => {
    map.set("number", 300);
    map.set("emptyObject", new Y.Map());
    map.set("basePath", "");
    map.set("basePath2", "");
  });

  expect(eventPaths).toEqual([
    [["number", "emptyObject", "basePath", "basePath2"]],
  ]);
});

test("returns changes in objects", async () => {
  const { map, eventPaths } = getBasicSetup();

  (map.get("emptyObject") as Y.Map<any>).set("Test", "Testing");
  (map.get("nestedMap") as Y.Map<any>)
    .get("nestedMapAgain")
    .set("nestedValue", "Changed");
  (map.get("nestedMap") as Y.Map<any>).set("nestedMapAgain", "Updated");
  (map.get("nestedMap") as Y.Map<any>).set("nestedMapAgain", undefined);

  expect(eventPaths).toEqual([
    [["emptyObject__Test"]],
    [["nestedMap__nestedMapAgain__nestedValue"]],
    [["nestedMap__nestedMapAgain"]],
    [["nestedMap__nestedMapAgain"]],
  ]);
});

test("returns changes in transaction multipath", async () => {
  const { map, eventPaths } = getBasicSetup();

  map.doc?.transact(() => {
    map.set("number", 300);
    map.set("emptyObject", new Y.Map());
    (map.get("nestedMap") as Y.Map<any>)
      .get("nestedMapAgain")
      .set("nestedValue", "Changed");
  });

  expect(eventPaths).toEqual([
    // 1 Transaction
    [
      // 2 Events (2 yjs object changed)
      ["number", "emptyObject"],
      ["nestedMap__nestedMapAgain__nestedValue"],
    ],
  ]);
});

test("returns changes in object when deleted", async () => {
  const { map, eventPaths } = getBasicSetup();

  map.delete("number");
  (map.get("nestedMap") as Y.Map<any>)
    .get("nestedMapAgain")
    .delete("nestedValue");

  expect(eventPaths).toEqual([
    [["number"]],
    [["nestedMap__nestedMapAgain__nestedValue"]],
  ]);
});

test("returns changes in object when cleared", async () => {
  const { map, eventPaths } = getBasicSetup();

  (map.get("nestedMap") as Y.Map<any>).clear();

  expect(eventPaths).toEqual([
    [["nestedMap__nestedArray", "nestedMap__nestedMapAgain"]],
  ]);
});

test("returns changes in array", async () => {
  const { map, eventPaths } = getBasicSetup();

  (map.get("emptyArray") as Y.Array<any>).insert(0, [
    "a",
    "b",
    "c",
    "d",
    "e",
    "f",
    "g",
    "h",
    "i",
  ]);
  map.doc?.transact(() => {
    (map.get("emptyArray") as Y.Array<any>).delete(1, 1);
    (map.get("emptyArray") as Y.Array<any>).insert(1, ["z", "y"]);
    (map.get("emptyArray") as Y.Array<any>).delete(4, 2);
    (map.get("emptyArray") as Y.Array<any>).insert(4, ["z"]);

    (map.get("emptyArray") as Y.Array<any>).delete(6, 2);
  });

  expect(eventPaths).toEqual([
    [
      [
        "emptyArray__0",
        "emptyArray__1",
        "emptyArray__2",
        "emptyArray__3",
        "emptyArray__4",
        "emptyArray__5",
        "emptyArray__6",
        "emptyArray__7",
        "emptyArray__8",
      ],
    ],
    [
      [
        "emptyArray__1",
        "emptyArray__2",
        "emptyArray__3",
        "emptyArray__4",
        "emptyArray__6",
        "emptyArray__7",
        "emptyArray__8",
      ],
    ],
  ]);
});

test("returns changes in nested array", async () => {
  const { map, eventPaths } = getBasicSetup();

  (map.get("nestedArray") as Y.Array<any>).get(0).insert(0, [1, 2]);
  (map.get("nestedArray") as Y.Array<any>).get(1).set("hello", "world");

  expect(eventPaths).toEqual([
    [["nestedArray__0__0", "nestedArray__0__1"]],
    [["nestedArray__1__hello"]],
  ]);
});

test("returns changes in array element that is just added", async () => {
  const { map, eventPaths } = getBasicSetup();

  (map.get("nestedArray") as Y.Array<any>).insert(0, [1, 2]);

  expect(eventPaths).toEqual([
    [["nestedArray__0", "nestedArray__1", "nestedArray__2", "nestedArray__3"]],
  ]);
});

test("returns changes in array element that is just removed", async () => {
  const { map, eventPaths } = getBasicSetup();

  (map.get("nestedArray") as Y.Array<any>).delete(0, 1);

  expect(eventPaths).toEqual([[["nestedArray__0", "nestedArray__1"]]]);
});
