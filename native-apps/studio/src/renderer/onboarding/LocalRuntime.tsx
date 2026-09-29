import { useEffect, useState } from "react";

import {
  type ProgressPayload,
  type RuntimeStatus,
  api,
  listen,
} from "../bridge/ipc";
import { RuntimeAdvanced } from "./RuntimeAdvanced";

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

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
        <p className="error">
          The runtime manager could not be started, so this option is
          unavailable. Signing in to a server still works.
        </p>
        {status.reason && <pre className="detail">{status.reason}</pre>}
        <div className="row">
          <button onClick={refresh}>Try again</button>
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
            <button
              className="primary"
              onClick={() =>
                void api.runtimeOpen().catch((e) => onError(String(e)))
              }
            >
              Open
            </button>
            <button
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
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="muted">
            {needsDownload
              ? "Everything runs here, with no internet needed after the first download (about 700 MB)."
              : "Everything runs here. No internet needed."}
          </p>
          <button
            className="primary"
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
          </button>
        </>
      )}

      {progress && (
        <div className="progress">
          <div className="progress-label">
            {progress.phase}
            {progress.total > 0 && ` ${progress.done} / ${progress.total}`}
            {progress.bytes ? ` · ${formatBytes(progress.bytes)}` : ""}
          </div>
          <div className="progress-track">
            <div
              className="progress-bar"
              style={{
                width:
                  progress.total > 0
                    ? `${Math.round((progress.done / progress.total) * 100)}%`
                    : "0%",
              }}
            />
          </div>
        </div>
      )}

      {warning && (
        <p className="warning">
          {warning}{" "}
          <button className="link" onClick={() => setWarning(null)}>
            Dismiss
          </button>
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
