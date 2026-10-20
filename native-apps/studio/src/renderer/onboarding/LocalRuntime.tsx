import { Alert, Button } from "@repo/ui";
import { useEffect, useState } from "react";

import {
  type ProgressPayload,
  type RuntimeStatus,
  api,
  listen,
} from "../bridge/ipc";
import { RuntimeProgress } from "../shared/RuntimeProgress";
import { RuntimeAdvanced } from "./RuntimeAdvanced";

/**
 * Running TheOpenPresenter on this computer. One button does the whole job:
 * download if needed, start, and open. Version numbers, logs and disk paths
 * are troubleshooting tools, so they live behind "Advanced".
 */
export function LocalRuntime({
  onError,
}: {
  onError: (message: string | null) => void;
}) {
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [progress, setProgress] = useState<ProgressPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [lanAddress, setLanAddress] = useState<string | null>(null);

  const refresh = () => {
    api
      .runtimeStatus()
      .then(setStatus)
      .catch((err) => onError(String(err)));
  };

  useEffect(() => {
    refresh();
    // Needed whenever the server is running, not only when this window was
    // what started it.
    api
      .localAddress()
      .then(setLanAddress)
      .catch(() => setLanAddress(null));
    const unsubscribers = [
      listen<ProgressPayload>("runtime:progress", setProgress),
      listen<{ message: string }>("runtime:warning", (payload) =>
        setWarning(payload.message),
      ),
      listen("runtime:ready", () => {
        setProgress(null);
        refresh();
      }),
      listen("runtime:exit", refresh),
    ];
    return () => unsubscribers.forEach((off) => off());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Download if needed, then start, then open. One action, because there is no
   * point at which a user would want to stop halfway.
   */
  const startAndOpen = async (installed: boolean) => {
    onError(null);
    setBusy(true);
    try {
      if (!installed) {
        await api.runtimeInstall();
      }
      const result = await api.runtimeStart();
      setLanAddress(result.lanAddress);
      // The main process navigates this window into the app on success, so
      // anything after this usually does not render.
    } catch (err) {
      onError(String(err));
      refresh();
    } finally {
      setBusy(false);
    }
  };

  if (!status) return <p className="muted">Checking…</p>;

  if (!status.available) {
    return (
      <section>
        <h2>Use this computer</h2>
        <Alert variant="destructive" size="sm">
          The runtime manager could not be started, so this option is
          unavailable. Signing in to a server still works.
        </Alert>
        {status.reason && <pre className="detail">{status.reason}</pre>}
        <div className="row">
          <Button variant="outline" onClick={refresh}>
            Try again
          </Button>
        </div>
      </section>
    );
  }

  const needsDownload = !status.current;

  return (
    <section>
      <h2>Use this computer</h2>

      {status.running ? (
        <>
          <p className="muted">The server is running on this computer.</p>
          <div className="row">
            <Button
              onClick={() =>
                void api.runtimeOpen().catch((e) => onError(String(e)))
              }
            >
              Open
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void (async () => {
                  setBusy(true);
                  try {
                    await api.runtimeStop();
                    refresh();
                  } finally {
                    setBusy(false);
                  }
                })()
              }
            >
              Stop
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="muted">
            {needsDownload
              ? "Everything runs here, with no internet needed after the first download (about 700 MB)."
              : "Everything runs here. No internet needed."}
          </p>
          <Button
            onClick={() => void startAndOpen(!needsDownload)}
            disabled={busy}
          >
            {busy
              ? progress
                ? "Setting up…"
                : "Starting…"
              : needsDownload
                ? "Download and start"
                : "Start"}
          </Button>
        </>
      )}

      {progress && <RuntimeProgress progress={progress} />}

      {warning && (
        <p className="warning">
          {warning}{" "}
          <Button variant="link" onClick={() => setWarning(null)}>
            Dismiss
          </Button>
        </p>
      )}

      {lanAddress && status.running && (
        <p className="muted small">
          Phones and screens on this network can join at{" "}
          <strong>
            {lanAddress}:{status.url?.split(":").pop()}
          </strong>
        </p>
      )}

      <RuntimeAdvanced status={status} onChanged={refresh} onError={onError} />
    </section>
  );
}
