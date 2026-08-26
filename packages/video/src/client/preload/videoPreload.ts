import { UniversalVideo } from "../../types";
import { isHlsUrl, isYouTubeUrl, resolveVideoUrl } from "../videoUrl";
import { warmHlsStream } from "./warmHlsStream";
import { warmProgressiveVideo } from "./warmProgressiveVideo";

export type VideoPreloadStatus = "idle" | "warming" | "ready" | "error";

export type VideoPreloadPriority = "eager" | "background";

type Entry = {
  url: string;
  status: VideoPreloadStatus;
  priority: VideoPreloadPriority;
  controller: AbortController | null;
  error: Error | null;
  startLevel: number | null;
};

/**
 * How many videos we warm at once. Keeping this low stops a project full of
 * videos from starving the segments the operator is about to need.
 */
const MAX_CONCURRENT = 2;

const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();

let running = 0;

const notify = () => {
  for (const listener of listeners) listener();
};

export const subscribeToVideoPreload = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getVideoPreloadStatus = (
  url: string | null,
): VideoPreloadStatus => {
  if (!url) return "idle";
  return entries.get(url)?.status ?? "idle";
};

export const getWarmedStartLevel = (url: string | null): number | null => {
  if (!url) return null;
  // Only ever assigned once a warm succeeds, so this is null until then
  return entries.get(url)?.startLevel ?? null;
};

const warm = (url: string, signal: AbortSignal) =>
  isHlsUrl(url)
    ? warmHlsStream(url, signal)
    : warmProgressiveVideo(url, signal).then(() => null);

const pickNext = (): Entry | undefined => {
  const pending = [...entries.values()].filter((x) => x.status === "idle");

  return (
    pending.find((x) => x.priority === "eager") ??
    pending.find((x) => x.priority === "background")
  );
};

const pump = () => {
  while (running < MAX_CONCURRENT) {
    const entry = pickNext();
    if (!entry) return;

    const controller = new AbortController();
    entry.status = "warming";
    entry.controller = controller;
    running++;
    notify();

    warm(entry.url, controller.signal)
      .then((startLevel) => {
        entry.status = "ready";
        entry.error = null;
        entry.startLevel = startLevel;
      })
      .catch((err: unknown) => {
        // An abort means the caller no longer wants this video
        if (controller.signal.aborted) {
          entry.status = "idle";
          return;
        }
        entry.status = "error";
        entry.error = err instanceof Error ? err : new Error(String(err));
      })
      .finally(() => {
        entry.controller = null;
        running--;
        notify();
        pump();
      });
  }
};

/** Queues a video to be warmed. Safe to call repeatedly with the same video */
export const preloadVideo = (
  video: UniversalVideo | null | undefined,
  priority: VideoPreloadPriority = "background",
) => {
  const url = resolveVideoUrl(video);

  // DEBT: Warm these up too
  if (!url || isYouTubeUrl(url)) return;

  const existing = entries.get(url);
  if (existing) {
    if (priority === "eager" && existing.priority === "background") {
      existing.priority = "eager";
      pump();
    }
    return;
  }

  entries.set(url, {
    url,
    status: "idle",
    priority,
    controller: null,
    error: null,
    startLevel: null,
  });

  pump();
};

export const resetVideoPreload = () => {
  for (const entry of entries.values()) entry.controller?.abort();
  entries.clear();
  running = 0;
  notify();
};
