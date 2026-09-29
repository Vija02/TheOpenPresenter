import { useState } from "react";

import { api } from "../bridge/ipc";
import { Logo } from "../shared/Logo";

/**
 * Shown when the instance the app is configured for cannot be reached.
 */
export function Unreachable({ label, url }: { label: string; url: string }) {
  const [busy, setBusy] = useState(false);
  const [failedAgain, setFailedAgain] = useState(false);

  const retry = async () => {
    setBusy(true);
    setFailedAgain(false);
    try {
      // Resolving means it reached the instance and navigated this window
      // away, so nothing after this matters. A throw means still down.
      await api.retryConnection();
    } catch {
      setFailedAgain(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="unreachable">
      <Logo size={56} />
      <h1>Can't reach {label}</h1>
      <p className="muted">
        The instance may be switched off, or this computer may be offline.
      </p>
      <p className="muted mono">{url}</p>

      {failedAgain && <p className="problem">Still no answer from {label}.</p>}

      <div className="row">
        <button
          className="primary"
          disabled={busy}
          onClick={() => void retry()}
        >
          {busy ? "Trying…" : "Try again"}
        </button>
        <button disabled={busy} onClick={() => void api.openSettings()}>
          Open settings
        </button>
      </div>
    </section>
  );
}
