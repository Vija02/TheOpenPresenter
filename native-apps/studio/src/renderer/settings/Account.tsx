import { Button, Input, Option } from "@repo/ui";
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
            <Option
              title={
                <span className="choice-head">
                  TheOpenPresenter Cloud
                  {busy === "cloud" && (
                    <span className="choice-tag">Connecting</span>
                  )}
                </span>
              }
              description="Use the hosted service. Needs a working internet connection."
              disabled={busy !== null}
              onClick={() => switchTo("cloud", "cloud", CLOUD_URL)}
            />

            <div className="instance-form">
              <p className="instance-form-title">Another computer</p>
              <p className="muted">
                A TheOpenPresenter instance someone else runs.
              </p>
              <div className="row">
                <Input
                  type="text"
                  value={customUrl}
                  placeholder="presenter.mychurch.org"
                  onChange={(event) => editCustomUrl(event.target.value)}
                  disabled={busy !== null}
                />
                <Button
                  variant="outline"
                  disabled={busy !== null || !customUrl.trim()}
                  onClick={() =>
                    switchTo("custom", "selfhosted", customUrl.trim())
                  }
                >
                  {busy === "custom" ? "Connecting…" : "Connect"}
                </Button>
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
            <Button
              disabled={busy !== null}
              onClick={() => switchTo("local", "local")}
            >
              {busy === "local" ? "Starting…" : "Run locally"}
            </Button>
          </div>

          {/* Still worth offering: moving between two remote servers is a
              different job from coming back to this computer. */}
          <div className="instance-form">
            <p className="instance-form-title">Use a different instance</p>
            <div className="row">
              <Input
                type="text"
                value={customUrl}
                placeholder="presenter.mychurch.org"
                onChange={(event) => editCustomUrl(event.target.value)}
                disabled={busy !== null}
              />
              <Button
                variant="outline"
                disabled={busy !== null || !customUrl.trim()}
                onClick={() =>
                  switchTo("custom", "selfhosted", customUrl.trim())
                }
              >
                {busy === "custom" ? "Connecting…" : "Connect"}
              </Button>
            </div>
            {connectProblem && (
              <span className="problem choice-problem">{connectProblem}</span>
            )}
            {!current?.isCloud && (
              <Button
                variant="link"
                disabled={busy !== null}
                onClick={() => switchTo("cloud", "cloud", CLOUD_URL)}
              >
                Use TheOpenPresenter Cloud instead
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
