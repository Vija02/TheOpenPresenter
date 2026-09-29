import { useEffect, useState } from "react";

import { type ConnectionSummary, api } from "../bridge/ipc";
import { CloudAccount } from "./CloudAccount";
import { Organizations } from "./Organizations";

const CLOUD_URL = "https://theopenpresenter.com";

export function Account() {
  const [current, setCurrent] = useState<ConnectionSummary | null>(null);
  const [customUrl, setCustomUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  /** Failures from the custom address field, shown beside it. */
  const [connectProblem, setConnectProblem] = useState<string | null>(null);

  useEffect(() => {
    api
      .connection()
      .then((summary) => {
        setCurrent(summary);
        if (!summary.isCloud && summary.rootUrl) setCustomUrl(summary.rootUrl);
      })
      .catch((err) => setProblem(String(err)));
  }, []);

  const switchTo = async (
    key: string,
    mode: "local" | "cloud" | "selfhosted",
    rootUrl?: string,
  ) => {
    setProblem(null);
    setConnectProblem(null);
    setBusy(key);
    try {
      setCurrent(await api.switchServer(mode, rootUrl));
      // The main process navigates the app window on success, so this panel
      // usually stops mattering here.
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // A bad address belongs next to the field that holds it. Anything else
      // is about the page as a whole and stays at the top.
      if (key === "custom") setConnectProblem(message);
      else setProblem(message);
    } finally {
      setBusy(null);
    }
  };

  const isLocal = current?.location === "this-computer";

  // Editing the address invalidates whatever the last attempt said about it.
  const editCustomUrl = (value: string) => {
    setCustomUrl(value);
    setConnectProblem(null);
  };

  return (
    <section className="panel-body">
      <h2>Account</h2>

      {problem && <p className="problem">{problem}</p>}

      {/* Only on a remote instance. Locally the user is the autologin account,
          so a sign-in banner would state something meaningless. */}
      {!isLocal && current && (
        <CloudAccount isCloud={current.isCloud} onError={setProblem} />
      )}

      {/* Only when this computer is the server. On someone else's server the
          organisations belong to that server and are managed there. */}
      {isLocal && <Organizations onError={setProblem} />}

      {isLocal ? (
        <>
          <h3>Use a different instance</h3>
          <p className="muted">
            Stop serving from this computer and connect to one somewhere else.
            Nothing here is deleted, and you can switch back at any time.
          </p>

          <div className="choices">
            <button
              className="choice"
              disabled={busy !== null}
              onClick={() => switchTo("cloud", "cloud", CLOUD_URL)}
            >
              <span className="choice-head">
                <span className="choice-title">TheOpenPresenter Cloud</span>
                {busy === "cloud" && (
                  <span className="choice-tag">Connecting</span>
                )}
              </span>
              <span className="muted">
                Use the hosted service. Needs a working internet connection.
              </span>
            </button>

            <div className="choice choice-static">
              <span className="choice-head">
                <span className="choice-title">Another computer</span>
              </span>
              <span className="muted">
                A TheOpenPresenter instance someone else runs.
              </span>
              <div className="row">
                <input
                  type="text"
                  value={customUrl}
                  placeholder="presenter.mychurch.org"
                  onChange={(event) => editCustomUrl(event.target.value)}
                  disabled={busy !== null}
                />
                <button
                  disabled={busy !== null || !customUrl.trim()}
                  onClick={() =>
                    switchTo("custom", "selfhosted", customUrl.trim())
                  }
                >
                  {busy === "custom" ? "Connecting…" : "Connect"}
                </button>
              </div>
              {connectProblem && (
                <span className="problem choice-problem">{connectProblem}</span>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <h3>Run local instance on this computer</h3>
          <p className="muted">
            Works without internet and you can sync to a cloud instance.
          </p>

          <div className="row">
            <button
              className="primary"
              disabled={busy !== null}
              onClick={() => switchTo("local", "local")}
            >
              {busy === "local" ? "Starting…" : "Run locally"}
            </button>
          </div>

          {/* Still worth offering: moving between two remote servers is a
              different job from coming back to this computer. */}
          <div className="choice choice-static">
            <span className="choice-head">
              <span className="choice-title">Use a different instance</span>
            </span>
            <div className="row">
              <input
                type="text"
                value={customUrl}
                placeholder="presenter.mychurch.org"
                onChange={(event) => editCustomUrl(event.target.value)}
                disabled={busy !== null}
              />
              <button
                disabled={busy !== null || !customUrl.trim()}
                onClick={() =>
                  switchTo("custom", "selfhosted", customUrl.trim())
                }
              >
                {busy === "custom" ? "Connecting…" : "Connect"}
              </button>
            </div>
            {connectProblem && (
              <span className="problem choice-problem">{connectProblem}</span>
            )}
            {!current?.isCloud && (
              <button
                className="link"
                disabled={busy !== null}
                onClick={() => switchTo("cloud", "cloud", CLOUD_URL)}
              >
                Use TheOpenPresenter Cloud instead
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
