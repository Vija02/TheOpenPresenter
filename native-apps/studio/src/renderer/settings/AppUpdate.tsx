import { useCallback, useEffect, useState } from "react";

import { type UpdateState, api, listen } from "../bridge/ipc";

/** App updates, in the About panel. */
export function AppUpdate() {
  const [state, setState] = useState<UpdateState>({ status: "idle" });
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    api
      .updateState()
      .then(setState)
      .catch(() => undefined);
    // The main process drives the download, so progress arrives as events
    // rather than from polling.
    return listen<UpdateState>("update:state", setState);
  }, []);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      setState(await api.checkForUpdate());
    } catch {
      // The state event carries the failure; nothing useful to add here.
    } finally {
      setChecking(false);
    }
  }, []);

  if (state.status === "unsupported") {
    return (
      <div className="about-group">
        <h3>Updates</h3>
        <p className="muted">{state.reason}</p>
      </div>
    );
  }

  return (
    <div className="about-group">
      <h3>Updates</h3>

      {state.status === "ready" ? (
        <>
          <p className="muted">
            Version {state.version} is ready. It will be applied next time the
            app starts.
          </p>
          <button className="primary" onClick={() => void api.installUpdate()}>
            Restart now
          </button>
        </>
      ) : state.status === "downloading" ? (
        <p className="muted">Downloading update… {state.percent}%</p>
      ) : (
        <>
          <p className="muted">
            {state.status === "error"
              ? "Could not check for updates."
              : "This app is up to date."}
          </p>
          <button
            disabled={checking || state.status === "checking"}
            onClick={() => void check()}
          >
            {checking || state.status === "checking"
              ? "Checking…"
              : "Check for updates"}
          </button>
        </>
      )}
    </div>
  );
}
