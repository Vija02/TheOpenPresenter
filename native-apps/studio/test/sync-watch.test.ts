import { describe, expect, it, vi } from "vitest";

import { type SyncAnswer, waitForSyncs } from "../src/main/local/syncWatch";

/** A clock that moves on by `step` each time it is slept on. */
function clock(step: number) {
  let time = 0;
  return {
    now: () => time,
    sleep: async () => {
      time += step;
    },
  };
}

const copying = {
  status: "COMPLETED",
  syncedProjects: 2,
  projectsToSync: 2,
  mediaStatus: "SYNCING",
  syncedMedia: 1,
  totalMedia: 4,
} as const;

describe("waitForSyncs", () => {
  it("gives up on a server that stops answering", async () => {
    const { now, sleep } = clock(30_000);
    let n = 0;
    const poll = vi.fn(async (): Promise<SyncAnswer> => {
      if (n++ === 0) return copying;
      throw new Error("connection refused");
    });

    const failed = await waitForSyncs({
      ids: ["conn-1"],
      poll,
      onProgress: () => {},
      now,
      sleep,
    });

    expect(failed).toBe(true);
    // Answered at 0s, then 2 minutes of failures before giving up.
    expect(poll.mock.calls.length).toBeGreaterThanOrEqual(5);
    expect(poll.mock.calls.length).toBeLessThan(8);
  });

  it("counts a removed connection as done", async () => {
    const answers: SyncAnswer[] = [copying, "removed"];
    let n = 0;
    const failed = await waitForSyncs({
      ids: ["conn-1"],
      poll: async () => answers[n++],
      onProgress: () => {},
      sleep: async () => {},
    });
    expect(failed).toBe(false);
  });

  it("calls a copy slow once nothing has moved for a long while", async () => {
    const { now, sleep } = clock(60_000);
    const slowness: boolean[] = [];
    let n = 0;

    await waitForSyncs({
      ids: ["conn-1"],
      poll: async () =>
        n++ < 12 ? copying : { ...copying, mediaStatus: "SYNCED" },
      onProgress: (_latest, slow) => slowness.push(slow),
      now,
      sleep,
    });

    expect(slowness.slice(0, 10).every((slow) => !slow)).toBe(true);
    expect(slowness[11]).toBe(true);
  });

  it("is not slow while the numbers keep moving", async () => {
    const { now, sleep } = clock(60_000);
    const slowness: boolean[] = [];
    let n = 0;

    await waitForSyncs({
      ids: ["conn-1"],
      poll: async () =>
        n < 15
          ? { ...copying, syncedMedia: n++ }
          : { ...copying, mediaStatus: "SYNCED" },
      onProgress: (_latest, slow) => slowness.push(slow),
      now,
      sleep,
    });

    expect(slowness.some(Boolean)).toBe(false);
  });
});
