import { afterEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import { syncDocAcrossTabs } from "./tabSync";

const cleanups: (() => void)[] = [];
const openTab = (name = "project") => {
  const doc = new Y.Doc();
  cleanups.push(syncDocAcrossTabs(doc, name));
  return doc;
};

afterEach(() => {
  cleanups.splice(0).forEach((stop) => stop());
});

describe("syncDocAcrossTabs", () => {
  it("passes live changes to other tabs", async () => {
    const a = openTab();
    const b = openTab();

    a.getMap().set("slide", 3);

    await vi.waitFor(() => expect(b.getMap().get("slide")).toBe(3));
  });

  it("catches up a tab opened later, both ways", async () => {
    const a = new Y.Doc();
    a.getMap().set("fromA", 1);
    cleanups.push(syncDocAcrossTabs(a, "project"));

    const b = new Y.Doc();
    b.getMap().set("fromB", 2);
    cleanups.push(syncDocAcrossTabs(b, "project"));

    await vi.waitFor(() => {
      expect(b.getMap().get("fromA")).toBe(1);
      expect(a.getMap().get("fromB")).toBe(2);
    });
  });

  it("keeps projects apart", async () => {
    const a = openTab("one");
    const b = openTab("two");
    const c = openTab("one");

    a.getMap().set("slide", 1);

    await vi.waitFor(() => expect(c.getMap().get("slide")).toBe(1));
    expect(b.getMap().get("slide")).toBeUndefined();
  });

  it("stops after cleanup", async () => {
    const a = openTab();
    const b = new Y.Doc();
    const stop = syncDocAcrossTabs(b, "project");
    stop();

    a.getMap().set("slide", 5);

    await new Promise((r) => setTimeout(r, 50));
    expect(b.getMap().get("slide")).toBeUndefined();
  });
});
