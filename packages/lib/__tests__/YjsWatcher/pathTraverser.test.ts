import { expect, test } from "vitest";
import * as Y from "yjs";

import { pathTraverser } from "../../src/YjsWatcher/pathTraverser";
import { MapType, getYDoc } from "../helpers";

test("returns basic path", async () => {
  const res1 = pathTraverser((x) => x.a.b);
  const res2 = pathTraverser((x) => x.number);
  const res3 = pathTraverser((x) => x.arrayTest[1]);
  const res4 = pathTraverser((x) => x);

  expect(res1).toEqual(["a__b"]);
  expect(res2).toEqual(["number"]);
  expect(res3).toEqual(["arrayTest__1"]);
  expect(res4).toEqual([""]);
});

test("returns only proxied result", async () => {
  const res1 = pathTraverser((x) => 1);
  const res2 = pathTraverser((x) => undefined);

  expect(res1).toEqual([]);
  expect(res2).toEqual([]);
});

test("returns current path if no fn passed", async () => {
  const res1 = pathTraverser();

  expect(res1).toEqual([""]);
});

test("returns mapped value in an array", async () => {
  const res = pathTraverser((x) => x.a.b);
  const res2 = pathTraverser((x) => ({
    hi: x.a[1],
    testing: x.b[2],
    anothertest: x[1].b,
  }));

  expect(res).toEqual(["a__b"]);
  expect(res2).toEqual(["a__1", "b__2", "1__b"]);
});

test("returns mapped value(array) in an array", async () => {
  const res = pathTraverser((x) => x.a.b);
  const res2 = pathTraverser((x) => [x.a[1], x.b[2], x[1].b]);

  expect(res).toEqual(["a__b"]);
  expect(res2).toEqual(["a__1", "b__2", "1__b"]);
});
