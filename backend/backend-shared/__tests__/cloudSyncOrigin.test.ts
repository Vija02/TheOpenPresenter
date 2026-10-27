import { describe, expect, it } from "vitest";

import { cloudSyncOriginFromHeaders } from "../src/cloud/sync/queue";

describe("cloudSyncOriginFromHeaders", () => {
  it("takes a connection id, of any UUID version", () => {
    const v7 = "01a17ce0-030e-7afc-8a2c-a73df77ad96f";
    expect(cloudSyncOriginFromHeaders({ "x-cloud-sync-origin": v7 })).toBe(v7);
  });

  it("ignores anything else", () => {
    for (const value of [undefined, "", "'; drop table x; --", ["a", "b"]]) {
      expect(cloudSyncOriginFromHeaders({ "x-cloud-sync-origin": value })).toBe(
        null,
      );
    }
  });
});
