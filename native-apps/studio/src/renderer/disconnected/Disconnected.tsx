import { Button } from "@repo/ui";
import { useState } from "react";

import { api } from "../bridge/ipc";

/**
 * Laid over the app window while the joined computer is away. The page stays
 * underneath, and this goes once the computer is back.
 */
export function Disconnected({ label }: { label: string }) {
  const [busy, setBusy] = useState(false);
  const [failedAgain, setFailedAgain] = useState(false);

  const retry = async () => {
    setBusy(true);
    setFailedAgain(false);
    try {
      await api.retryConnection();
    } catch {
      setFailedAgain(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="disconnected" role="alertdialog" aria-live="assertive">
      <h1>Disconnected</h1>
      <p>
        Can&apos;t reach {label}. This will reconnect by itself when it&apos;s
        back.
      </p>
      {failedAgain && <p className="muted">Still no answer.</p>}
      <Button variant="outline" disabled={busy} onClick={() => void retry()}>
        {busy ? "Trying…" : "Try again"}
      </Button>
    </section>
  );
}
