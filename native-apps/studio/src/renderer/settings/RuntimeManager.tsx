import { useCallback, useEffect, useState } from "react";

import { type RuntimeStatus, api } from "../bridge/ipc";

function pendingRestartVersion(
  runningVersion: string | null,
  activatedVersion: string | null,
): string | null {
  if (!runningVersion || !activatedVersion) return null;
  if (runningVersion === activatedVersion) return null;
  return runningVersion;
}

/** Managing the installed runtime */
export function RuntimeManager() {
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [available, setAvailable] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  // Diverges from the activated version only between switching and
  // restarting. Captured on first load because nothing else reports it.
  const [runningVersion, setRunningVersion] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await api.runtimeStatus();
      setStatus(next);
      setRunningVersion((previous) => {
        if (previous) return previous;
        return next.available && next.running ? next.current : null;
      });
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const checkForUpdate = async () => {
    setBusy("check");
    setProblem(null);
    try {
      const found = await api.runtimeCheck();
      setAvailable(found.version);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  };

  const install = async () => {
    setBusy("install");
    setProblem(null);
    try {
      await api.runtimeInstall();
      setAvailable(null);
      await refresh();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  };

  /** Restart onto the activated version, then re-read what is running. */
  const restart = async () => {
    setBusy("restart");
    setProblem(null);
    try {
      const result = await api.restartRuntime();
      setRunningVersion(result.version);
      await refresh();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  };

  const activate = async (version: string) => {
    setBusy(version);
    setProblem(null);
    try {
      await api.activateRuntime(version);
      await refresh();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  };

  // `available: false` means the manager could not be reached, a different
  // problem from having no runtime installed.
  const ready = status?.available === true ? status : null;
  const installed = ready?.installed ?? [];
  const current = ready?.current ?? null;
  const pendingVersion = pendingRestartVersion(runningVersion, current);
  const updatable = available && available !== current;

  if (status && !ready) {
    return (
      <section className="panel-body">
        <h2>Local runtime</h2>
        <p className="problem">
          {("reason" in status && status.reason) ||
            "The runtime manager is not available."}
        </p>
      </section>
    );
  }

  return (
    <section className="panel-body">
      <h2>Local runtime</h2>

      <dl className="facts">
        <dt>In use</dt>
        <dd>{current ?? "None installed"}</dd>
      </dl>

      {pendingVersion && (
        <div className="notice">
          <p>
            The server is still running {pendingVersion}. Restart it to use{" "}
            {current}.
          </p>
          <button
            className="primary"
            onClick={() => void restart()}
            disabled={busy !== null}
          >
            {busy === "restart" ? "Restarting…" : "Restart the instance"}
          </button>
        </div>
      )}

      <div className="row">
        <button onClick={() => void checkForUpdate()} disabled={busy !== null}>
          {busy === "check" ? "Checking…" : "Check for updates"}
        </button>
        {updatable && (
          <button
            className="primary"
            onClick={() => void install()}
            disabled={busy !== null}
          >
            {busy === "install" ? "Downloading…" : `Update to ${available}`}
          </button>
        )}
      </div>

      {available && !updatable && (
        <p className="muted">This is the newest version.</p>
      )}

      {installed.length > 1 && (
        <>
          <h3>Installed versions</h3>
          <ul className="versions">
            {installed.map((version) => (
              <li key={version}>
                <span>{version}</span>
                {version === current ? (
                  <span className="muted">in use</span>
                ) : (
                  <button
                    className="link"
                    onClick={() => void activate(version)}
                    disabled={busy !== null}
                  >
                    {busy === version ? "Switching…" : "Use this one"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {problem && <p className="problem">{problem}</p>}
    </section>
  );
}
