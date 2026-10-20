import { Button } from "@repo/ui";

import { api } from "../bridge/ipc";
import { Logo } from "../shared/Logo";
import { useUpdateState } from "../shared/useUpdateState";

/**
 * Offer an update, download it when asked, then offer to restart into it.
 * "Later" only closes this window: a downloaded update still applies on quit.
 */
export function UpdatePrompt() {
  const [state] = useUpdateState();
  const later = () => void api.dismissUpdate();

  if (state.status === "downloading") {
    return (
      <section className="update-prompt">
        <Logo size={48} />
        <h1>Downloading version {state.version}</h1>
        <div className="progress" role="status">
          <div className="progress-label">{state.percent}%</div>
          <div className="progress-track">
            <div
              className="progress-bar"
              style={{ width: `${state.percent}%` }}
            />
          </div>
        </div>
        <div className="row">
          <Button variant="outline" onClick={later}>
            Hide
          </Button>
        </div>
      </section>
    );
  }

  if (state.status === "ready") {
    return (
      <section className="update-prompt">
        <Logo size={48} />
        <h1>Version {state.version} is ready</h1>
        <p className="muted">
          Restart to start using it, or it will be applied next time the app
          starts.
        </p>
        <div className="row">
          <Button onClick={() => void api.installUpdate()}>Restart now</Button>
          <Button variant="outline" onClick={later}>
            Later
          </Button>
        </div>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="update-prompt">
        <Logo size={48} />
        <h1>Update failed</h1>
        <p className="muted">
          The download did not finish. Check the connection and try again.
        </p>
        <div className="row">
          <Button onClick={() => void api.downloadUpdate()}>Try again</Button>
          <Button variant="outline" onClick={later}>
            Later
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="update-prompt">
      <Logo size={48} />
      <h1>Update available</h1>
      <p className="muted">
        {state.status === "available"
          ? `Version ${state.version} of TheOpenPresenter is available.`
          : "A new version of TheOpenPresenter is available."}
      </p>
      <div className="row">
        <Button onClick={() => void api.downloadUpdate()}>Update</Button>
        <Button variant="outline" onClick={later}>
          Later
        </Button>
      </div>
    </section>
  );
}
