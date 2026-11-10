import { describe, expect, it, vi } from "vitest";

import { FirstSync, type FirstSyncState } from "../src/main/local/firstSync";
import { describeSync } from "../src/renderer/setupbar/describe";

const done = {
  status: "COMPLETED",
  syncedProjects: 2,
  projectsToSync: 2,
} as const;

function sequence(...answers: unknown[]) {
  let n = 0;
  return vi.fn(async () => answers[Math.min(n++, answers.length - 1)] as never);
}

describe("FirstSync", () => {
  it("follows an organization through its projects and media, then clears", async () => {
    vi.useFakeTimers();
    const sync = new FirstSync({
      syncProgress: sequence(
        { status: "IN_PROGRESS", syncedProjects: 1, projectsToSync: 2 },
        { ...done, mediaStatus: "SYNCING", syncedMedia: 1, totalMedia: 4 },
        { ...done, mediaStatus: "SYNCED", syncedMedia: 4, totalMedia: 4 },
      ),
      sleep: async () => {},
      doneForMs: 1000,
    });
    const states: FirstSyncState[] = [];
    sync.on("state", (s) => states.push(s));

    await sync.watch("http://localhost:4000", "conn-1", "Grace");

    expect(states).toContainEqual(
      expect.objectContaining({
        phase: "syncing",
        stage: "projects",
        synced: 1,
      }),
    );
    expect(states).toContainEqual(
      expect.objectContaining({
        phase: "syncing",
        stage: "media",
        synced: 1,
        total: 4,
      }),
    );
    expect(sync.state).toEqual({
      phase: "done",
      names: ["Grace"],
      failed: false,
    });

    vi.advanceTimersByTime(1000);
    expect(sync.state).toEqual({ phase: "idle" });
    vi.useRealTimers();
  });

  it("says so when the media did not copy", async () => {
    const sync = new FirstSync({
      syncProgress: sequence({ ...done, mediaStatus: "FAILED" }),
      sleep: async () => {},
    });
    await sync.watch("http://localhost:4000", "conn-1", "Grace");
    expect(sync.state).toEqual({
      phase: "done",
      names: ["Grace"],
      failed: true,
    });
  });
});

describe("describeSync", () => {
  it("names the organization while copying its media", () => {
    const view = describeSync({
      phase: "syncing",
      names: ["Grace"],
      stage: "media",
      synced: 1,
      total: 4,
      bytes: { done: 50, total: 200 },
    });
    expect(view.label).toBe("Copying media for Grace · 1 of 4");
    expect(view.percent).toBe(25);
    expect(view.switchButton).toBe("none");
  });

  it("says when a copy is taking longer than usual", () => {
    const view = describeSync({
      phase: "syncing",
      names: ["Grace"],
      stage: "media",
      synced: 1,
      total: 4,
      slow: true,
    });
    expect(view.label).toBe(
      "Copying media for Grace is taking longer than usual",
    );
    expect(view.tone).toBe("normal");
  });

  it("says when it is ready", () => {
    expect(
      describeSync({ phase: "done", names: ["Grace", "Hope"], failed: false })
        .label,
    ).toBe("Grace and Hope are ready on this computer");
  });
});
