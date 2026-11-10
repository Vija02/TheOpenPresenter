import { useCallback, useEffect, useState } from "react";

import {
  type LocalSetupState,
  type ProgressPayload,
  api,
  listen,
} from "../bridge/ipc";

export type DownloadState = {
  active: boolean;
  done: boolean;
  failed: string | null;
  progress: ProgressPayload | null;
};

const fromSetup = (state: LocalSetupState): DownloadState => ({
  active: state.phase === "downloading",
  done:
    state.phase === "starting" ||
    state.phase === "syncing" ||
    state.phase === "ready",
  failed: state.phase === "failed" ? state.message : null,
  progress: state.phase === "downloading" ? state.progress : null,
});

/**
 * The runtime download, as seen from setup. The download itself runs in the
 * main process, so it carries on after this window closes and the user is
 * already working online.
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

  useEffect(() => {
    void api
      .localSetupState()
      .then((s) => setState(fromSetup(s)))
      .catch(() => undefined);
    return listen<LocalSetupState>("local-setup:state", (s) =>
      setState(fromSetup(s)),
    );
  }, []);

  const start = useCallback(
    (channel?: string) => api.localSetupDownload(channel),
    [],
  );

  /** Resolves once the runtime is installed; rejects if the download failed. */
  const wait = useCallback(() => api.localSetupWaitForDownload(), []);

  return { ...state, start, wait };
}
