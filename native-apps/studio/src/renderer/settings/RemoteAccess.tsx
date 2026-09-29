import { useCallback, useEffect, useState } from "react";

import { type RemoteStatus, api } from "../bridge/ipc";

/** Peer-to-peer access to this computer's server */
export function RemoteAccess() {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<RemoteStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setStatus(await api.remoteStatus());
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    }
  }, []);

  useEffect(() => {
    void refresh();
    // The toggle needs the server to be up, and there is no parent left to
    // be told by.
    api
      .runtimeStatus()
      .then((s) => setRunning(s.available === true && s.running))
      .catch(() => setRunning(false));
  }, [refresh]);

  const toggle = async () => {
    setBusy(true);
    setProblem(null);
    try {
      setStatus(
        status?.enabled ? await api.stopRemote() : await api.startRemote(),
      );
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!status?.ticket) return;
    await api.copyText(status.ticket);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (status?.supported === false) return null;

  return (
    <section className="panel-body">
      <h2>Remote access</h2>
      <p className="muted">
        Lets another device reach this computer from outside the building,
        without changing anything on the router.
      </p>

      <div className="row">
        <button onClick={() => void toggle()} disabled={busy || !running}>
          {busy ? "Working…" : status?.enabled ? "Turn off" : "Turn on"}
        </button>
        {!running && <span className="muted">Start the server first.</span>}
      </div>

      {status?.enabled && status.ticket && (
        <div className="ticket">
          <label>Connection ticket</label>
          <textarea readOnly value={status.ticket} rows={3} />
          <button className="link" onClick={() => void copy()}>
            {copied ? "Copied" : "Copy ticket"}
          </button>
        </div>
      )}

      {problem && <p className="problem">{problem}</p>}
    </section>
  );
}
