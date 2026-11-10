import { EventEmitter } from "events";

import {
  type SyncAnswer,
  type SyncProgress,
  type SyncView,
  describeRuns,
  waitForSyncs,
} from "./syncWatch";

/**
 * Organizations copied to this computer after setup, from settings. Their
 * media arrives after the projects, so until it has, a project can show
 * images that are not there yet; the bar says why.
 */

export type FirstSyncState =
  | { phase: "idle" }
  | ({ phase: "syncing"; names: string[] } & SyncView)
  | { phase: "done"; names: string[]; failed: boolean };

export type FirstSyncDeps = {
  syncProgress: (base: string, id: string) => Promise<SyncAnswer>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /** How long "done" stays up before the bar goes away. */
  doneForMs?: number;
};

type Copy = {
  name: string;
  progress: SyncProgress | null;
  slow: boolean;
  done: boolean;
};

export class FirstSync extends EventEmitter {
  private current: FirstSyncState = { phase: "idle" };
  private copies = new Map<string, Copy>();
  private failed = false;
  private clearTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly deps: FirstSyncDeps) {
    super();
  }

  get state(): FirstSyncState {
    return this.current;
  }

  /** Follow a connection's first sync until projects and media are in. */
  watch(base: string, connectionId: string, name: string): Promise<void> {
    if (this.copies.has(connectionId)) return Promise.resolve();
    if (this.clearTimer) clearTimeout(this.clearTimer);
    this.clearTimer = null;
    // A new batch: what finished before has already been reported.
    if (this.current.phase !== "syncing") {
      this.copies.clear();
      this.failed = false;
    }
    this.copies.set(connectionId, {
      name,
      progress: null,
      slow: false,
      done: false,
    });
    this.publish();

    return waitForSyncs({
      ids: [connectionId],
      poll: (id) => this.deps.syncProgress(base, id),
      onProgress: (latest, slow) => {
        const copy = this.copies.get(connectionId);
        if (!copy) return;
        copy.progress = latest.get(connectionId) ?? null;
        copy.slow = slow;
        this.publish();
      },
      wanted: () => this.copies.has(connectionId),
      sleep: this.deps.sleep,
      now: this.deps.now,
    }).then((failed) => {
      const copy = this.copies.get(connectionId);
      if (!copy) return;
      copy.done = true;
      this.failed ||= failed;
      this.publish();
    });
  }

  private publish(): void {
    const copies = [...this.copies.values()];
    const names = copies.map((c) => c.name);

    if (copies.some((c) => !c.done)) {
      const runs = copies.flatMap((c) => (c.progress ? [c.progress] : []));
      this.set({
        phase: "syncing",
        names,
        ...describeRuns(runs, copies.length),
        slow: copies.some((c) => !c.done && c.slow),
      });
      return;
    }

    this.set({ phase: "done", names, failed: this.failed });
    if (this.clearTimer) clearTimeout(this.clearTimer);
    this.clearTimer = setTimeout(() => {
      this.copies.clear();
      this.set({ phase: "idle" });
    }, this.deps.doneForMs ?? 6000);
  }

  private set(state: FirstSyncState): void {
    this.current = state;
    this.emit("state", state);
  }
}
