import { Button } from "@repo/ui";
import { useState } from "react";

import { type RuntimeStatus, api } from "../bridge/ipc";
import { RuntimePaths } from "./RuntimePaths";
import { RuntimeSource } from "./RuntimeSource";

/**
 * Version numbers, update checks, file locations and logs: what you reach for
 * when something has gone wrong, rather than part of using the app. Collapsed
 * by default so the normal path is one button.
 */
export function RuntimeAdvanced({
  status,
  onChanged,
  onError,
}: {
  status: Extract<RuntimeStatus, { available: true }>;
  onChanged: () => void;
  onError: (message: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  if (!open) {
    return (
      <p className="muted small">
        <Button variant="link" onClick={() => setOpen(true)}>
          Advanced
        </Button>
      </p>
    );
  }

  const checkForUpdates = async () => {
    onError(null);
    setBusy(true);
    try {
      const result = await api.runtimeInstall();
      setPending(result.pendingRestart ? result.version : null);
      onChanged();
    } catch (err) {
      onError(String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="advanced">
      <p className="muted small">
        <Button variant="link" onClick={() => setOpen(false)}>
          Hide advanced
        </Button>
      </p>

      <dl className="facts">
        <dt>Version</dt>
        <dd>{status.current ?? "none installed"}</dd>
        {status.installed.length > 1 && (
          <>
            <dt>Also installed</dt>
            <dd>{status.installed.join(", ")}</dd>
          </>
        )}
        {status.crashCount > 0 && (
          <>
            <dt>Recent failures</dt>
            <dd className="warn">{status.crashCount}</dd>
          </>
        )}
      </dl>

      {pending && (
        <p className="muted">
          Version {pending} is downloaded and will be used next time the server
          starts.
        </p>
      )}

      <div className="row">
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void checkForUpdates()}
        >
          {busy ? "Checking…" : "Check for updates"}
        </Button>
        <Button variant="outline" onClick={() => void api.openRuntimeLogs()}>
          Show the log
        </Button>
      </div>

      <RuntimeSource onChanged={onChanged} />
      <RuntimePaths />
    </section>
  );
}
