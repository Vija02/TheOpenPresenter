/** Waiting for an organization's first copy: its projects, then its media. */

export type SyncProgress = {
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  syncedProjects: number;
  projectsToSync: number;
  /** Absent from servers that do not report media separately. */
  mediaStatus?: "PENDING" | "SYNCING" | "SYNCED" | "FAILED";
  syncedMedia?: number;
  totalMedia?: number;
  downloadedBytes?: number;
  totalBytes?: number;
};

/** How far the copies have got, as a whole. */
export type SyncView = {
  stage: "projects" | "media";
  synced: number;
  total: number;
  /** Bytes, during media, when known. */
  bytes?: { done: number; total: number };
  /** Nothing has moved for a long while. */
  slow?: boolean;
};

/** What a poll can say: a run, no run yet, or no such connection any more. */
export type SyncAnswer = SyncProgress | null | "removed";

const POLL_MS = 1000;
/** A sync that never shows up was most likely never queued. */
const NO_RUN_TIMEOUT_MS = 30_000;
/** A server that cannot answer this long is not going to copy anything. */
const UNREACHABLE_TIMEOUT_MS = 2 * 60_000;
/** Large media can be slow, so this only changes the wording. */
const SLOW_AFTER_MS = 10 * 60_000;

const projectsDone = (p: SyncProgress) =>
  p.status === "COMPLETED" || p.status === "FAILED";
const mediaDone = (p: SyncProgress) =>
  !p.mediaStatus || p.mediaStatus === "SYNCED" || p.mediaStatus === "FAILED";
const anyFailed = (p: SyncProgress) =>
  p.status === "FAILED" || p.mediaStatus === "FAILED";

export const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Projects until every copy has its projects, then media. */
export function describeRuns(runs: SyncProgress[], expected: number): SyncView {
  const sum = (pick: (p: SyncProgress) => number | undefined) =>
    runs.reduce((total, p) => total + (pick(p) ?? 0), 0);

  if (runs.length < expected || !runs.every(projectsDone)) {
    return {
      stage: "projects",
      synced: sum((p) => p.syncedProjects),
      total: sum((p) => p.projectsToSync),
    };
  }

  const totalBytes = sum((p) => p.totalBytes);
  return {
    stage: "media",
    synced: sum((p) => p.syncedMedia),
    total: sum((p) => p.totalMedia),
    bytes:
      totalBytes > 0
        ? { done: sum((p) => p.downloadedBytes), total: totalBytes }
        : undefined,
  };
}

/**
 * Poll each connection's run until projects and media are done. Resolves true
 * when any of them failed, never started, or stopped answering. A removed
 * connection counts as done.
 */
export async function waitForSyncs(options: {
  ids: string[];
  poll: (id: string) => Promise<SyncAnswer>;
  onProgress: (latest: Map<string, SyncProgress>, slow: boolean) => void;
  /** False once nobody wants the answer any more. */
  wanted?: () => boolean;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}): Promise<boolean> {
  const { ids, poll, onProgress } = options;
  const wanted = options.wanted ?? (() => true);
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const started = now();
  const finished = new Map<string, boolean>();
  /** Last progress each reported, so a missed poll is not "never ran". */
  const latest = new Map<string, SyncProgress>();
  const lastAnswer = new Map<string, number>();
  const lastChange = new Map<string, { key: string; at: number }>();

  while (finished.size < ids.length && wanted()) {
    for (const id of ids) {
      if (finished.has(id)) continue;
      let answer: SyncAnswer;
      try {
        answer = await poll(id);
      } catch {
        if (now() - (lastAnswer.get(id) ?? started) > UNREACHABLE_TIMEOUT_MS) {
          finished.set(id, true);
        }
        continue;
      }
      lastAnswer.set(id, now());

      if (answer === "removed") {
        finished.set(id, false);
      } else if (answer) {
        latest.set(id, answer);
        const key = JSON.stringify(answer);
        if (lastChange.get(id)?.key !== key) {
          lastChange.set(id, { key, at: now() });
        }
        if (projectsDone(answer) && mediaDone(answer)) {
          finished.set(id, anyFailed(answer));
        }
      } else if (!latest.has(id) && now() - started > NO_RUN_TIMEOUT_MS) {
        finished.set(id, true);
      }
    }

    const slow = ids.some((id) => {
      const change = lastChange.get(id);
      return !finished.has(id) && !!change && now() - change.at > SLOW_AFTER_MS;
    });
    onProgress(latest, slow);
    if (finished.size < ids.length) await sleep(POLL_MS);
  }

  return [...finished.values()].some(Boolean);
}
