import { useCallback, useEffect, useRef, useState } from "react";

import { type ProgressPayload, api, listen } from "../bridge/ipc";

export type DownloadState = {
  active: boolean;
  done: boolean;
  failed: string | null;
  progress: ProgressPayload | null;
};

/**
 * Download the runtime in the background, so setup is not a progress bar. It
 * is ~140MB and takes minutes on a church connection, which is about as long
 * as sign-in takes a person, so the two run together.
 *
 * Deliberately not cancellable: a half-downloaded runtime is resumable rather
 * than failed, because the content-addressed store keeps every verified blob.
 */
export function useRuntimeDownload() {
  const [state, setState] = useState<DownloadState>({
    active: false,
    done: false,
    failed: null,
    progress: null,
  });

  // A second start when React re-runs effects would fail with "a runtime is
  // already installing".
  const started = useRef(false);

  // Held so `wait` can await the same operation rather than polling state,
  // where a sample between "active false" and "done true" sees neither.
  const inFlight = useRef<Promise<void> | null>(null);

  useEffect(() => {
    const off = listen<ProgressPayload>("runtime:progress", (progress) =>
      setState((prev) => ({ ...prev, progress })),
    );
    return off;
  }, []);

  const start = useCallback((channel?: string) => {
    if (started.current) return inFlight.current ?? Promise.resolve();
    started.current = true;

    setState((prev) => ({ ...prev, active: true, failed: null }));

    const run = (async () => {
      try {
        const status = await api.runtimeStatus();
        if (status.available && status.current) {
          // Already installed, so re-running install would be a long no-op.
          setState((prev) => ({ ...prev, active: false, done: true }));
          return;
        }

        await api.runtimeInstall(channel);
        setState((prev) => ({ ...prev, active: false, done: true }));
      } catch (err) {
        started.current = false;
        inFlight.current = null;
        setState((prev) => ({
          ...prev,
          active: false,
          failed: String(err),
        }));
        throw err;
      }
    })();

    inFlight.current = run;
    return run;
  }, []);

  /**
   * Resolve once the runtime is installed. Returns immediately when nothing is
   * running, either because the download finished or because this is a minimal
   * setup. A failure rejects, so the caller can show why rather than
   * continuing into a broken state.
   */
  const wait = useCallback(() => inFlight.current ?? Promise.resolve(), []);

  return { ...state, start, wait };
}
