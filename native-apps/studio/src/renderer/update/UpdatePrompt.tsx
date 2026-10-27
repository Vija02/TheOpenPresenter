import { Button } from "@repo/ui";

import type { RuntimeUpdateState, UpdateState } from "../bridge/ipc";
import { api } from "../bridge/ipc";
import { Logo } from "../shared/Logo";
import { RuntimeProgress } from "../shared/RuntimeProgress";
import {
  useRuntimeUpdateState,
  useUpdateState,
} from "../shared/useUpdateState";

/** Whether the app itself is part of what this popup is about. */
function appInvolved(state: UpdateState): boolean {
  if (state.status === "error") return !!state.version;
  return ["available", "downloading", "ready"].includes(state.status);
}

function runtimeInvolved(state: RuntimeUpdateState): boolean {
  return ["available", "downloading", "ready", "error"].includes(state.status);
}

function appVersion(state: UpdateState): string | null {
  return "version" in state ? (state.version ?? null) : null;
}

function runtimeVersion(state: RuntimeUpdateState): string | null {
  return "version" in state ? state.version : null;
}

/**
 * Offer the app and runtime updates found at launch, download them when
 * asked, then offer to restart into them. "Later" only closes this window:
 * whatever was downloaded still applies on the next start.
 */
export function UpdatePrompt() {
  const [app] = useUpdateState();
  const runtime = useRuntimeUpdateState();
  const later = () => void api.dismissUpdate();

  const hasApp = appInvolved(app);
  const hasRuntime = runtimeInvolved(runtime);
  const parts: string[] = [];
  if (hasApp) parts.push(app.status);
  if (hasRuntime) parts.push(runtime.status);

  const offerLines = (
    <ul className="update-list">
      {hasApp && (
        <li>
          <span>App</span>
          <span className="muted">{appVersion(app)}</span>
        </li>
      )}
      {hasRuntime && (
        <li>
          <span>Runtime</span>
          <span className="muted">
            {runtime.status === "available" && runtime.current
              ? `${runtime.current} → ${runtime.version}`
              : runtimeVersion(runtime)}
          </span>
        </li>
      )}
    </ul>
  );

  if (parts.includes("downloading")) {
    return (
      <section className="update-prompt">
        <Logo size={48} />
        <h1>Downloading update</h1>
        {hasApp && (
          <div className="progress" role="status">
            <div className="progress-label">
              App {appVersion(app)}
              {app.status === "downloading" && ` · ${app.percent}%`}
              {app.status === "ready" && " · Done"}
            </div>
            <div className="progress-track">
              <div
                className="progress-bar"
                style={{
                  width: `${app.status === "downloading" ? app.percent : app.status === "ready" ? 100 : 0}%`,
                }}
              />
            </div>
          </div>
        )}
        {hasRuntime &&
          (runtime.status === "downloading" ? (
            <RuntimeProgress progress={runtime.progress} />
          ) : (
            <div className="progress">
              <div className="progress-label">
                Runtime {runtimeVersion(runtime)}
                {runtime.status === "ready" ? " · Done" : ""}
              </div>
            </div>
          ))}
        <div className="row">
          <Button variant="outline" onClick={later}>
            Hide
          </Button>
        </div>
      </section>
    );
  }

  if (parts.includes("error")) {
    return (
      <section className="update-prompt">
        <Logo size={48} />
        <h1>Update failed</h1>
        <p className="muted">
          {app.status === "error" && runtime.status === "error"
            ? "Neither download finished."
            : app.status === "error"
              ? "The app download did not finish."
              : "The runtime download did not finish."}{" "}
          Check the connection and try again.
        </p>
        <div className="row">
          <Button onClick={() => void api.downloadUpdates()}>Try again</Button>
          <Button variant="outline" onClick={later}>
            Later
          </Button>
        </div>
      </section>
    );
  }

  if (parts.length > 0 && parts.every((status) => status === "ready")) {
    const restartNeeded =
      hasApp || (runtime.status === "ready" && runtime.needsRestart);
    return (
      <section className="update-prompt">
        <Logo size={48} />
        <h1>Update ready</h1>
        {offerLines}
        <p className="muted">
          {!restartNeeded
            ? "It will be used next time the server starts."
            : "Restart to start using it, or it will be applied next time the app starts."}
        </p>
        <div className="row">
          {restartNeeded ? (
            <>
              <Button onClick={() => void api.installUpdate()}>
                Restart now
              </Button>
              <Button variant="outline" onClick={later}>
                Later
              </Button>
            </>
          ) : (
            <Button onClick={later}>Close</Button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="update-prompt">
      <Logo size={48} />
      <h1>Update available</h1>
      {offerLines}
      <div className="row">
        <Button onClick={() => void api.downloadUpdates()}>Update</Button>
        <Button variant="outline" onClick={later}>
          Later
        </Button>
      </div>
    </section>
  );
}
