import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui";
import { useEffect, useRef, useState } from "react";

import { type SetupBarContent, api, listen } from "../bridge/ipc";
import { describeBar } from "./describe";

/**
 * The card in the bottom-right of the app window: getting this computer ready to
 * work offline, or copying organizations to it. The main process decides
 * which.
 */
export function SetupBar() {
  const [state, setState] = useState<SetupBarContent>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const announce = state?.kind === "setup" && state.announce;
  const showCard = state !== null && !announce;

  useEffect(() => {
    void api
      .setupBarContent()
      .then(setState)
      .catch(() => undefined);
    return listen<SetupBarContent>("setup-bar:content", (next) => {
      setState(next);
      setProblem(null);
    });
  }, []);

  useEffect(() => {
    const element = card.current;
    if (!element) return;
    const observer = new ResizeObserver(
      () =>
        void api.setupBarHeight(element.offsetHeight).catch(() => undefined),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [showCard]);

  if (!state) return null;
  const view = describeBar(state);

  const switchNow = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await api.localSetupSwitch();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  if (announce) {
    const syncFailed = state.state.phase === "ready" && state.state.syncFailed;
    return (
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open && !busy) void api.setupBarLater();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ready to work offline</DialogTitle>
            <DialogDescription>
              Your organizations are on this computer now. Switch to Local to
              keep presenting without the internet.
            </DialogDescription>
          </DialogHeader>
          {(syncFailed || problem) && (
            <DialogBody>
              <p className="setup-ready-note">
                {problem
                  ? "Couldn't switch. Try again."
                  : "Some projects or media didn't copy yet."}
              </p>
            </DialogBody>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void api.setupBarLater()}
            >
              Not now
            </Button>
            <Button disabled={busy} onClick={() => void switchNow()}>
              {busy ? "Switching…" : "Switch to Local"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div
      ref={card}
      className={`setup-bar ${view.tone === "warn" ? "warn" : ""}`}
    >
      <div className="setup-bar-status" role="status">
        <span
          className="setup-bar-label"
          title={
            problem ??
            (state.kind === "setup" && state.state.phase === "failed"
              ? state.state.message
              : undefined)
          }
        >
          {problem ? "Couldn't switch. Try again." : view.label}
        </span>
        {view.percent !== undefined && (
          <div
            className={`setup-bar-track ${view.percent === null ? "indeterminate" : ""}`}
            aria-hidden
          >
            <div
              className="setup-bar-fill"
              style={
                view.percent === null
                  ? undefined
                  : { width: `${view.percent}%` }
              }
            />
          </div>
        )}
      </div>

      <div className="setup-bar-actions">
        {view.retry && (
          <Button
            size="xs"
            variant="outline"
            onClick={() => void api.localSetupRetry()}
          >
            Try again
          </Button>
        )}
        {view.switchButton === "quiet" && (
          <Button
            size="xs"
            variant="link"
            disabled={busy}
            onClick={() => void switchNow()}
          >
            {busy ? "Switching…" : "Switch to Local now"}
          </Button>
        )}
        {view.switchButton === "primary" && (
          <Button size="xs" disabled={busy} onClick={() => void switchNow()}>
            {busy ? "Switching…" : "Switch to Local"}
          </Button>
        )}
        <Button
          size="xs"
          variant="ghost"
          aria-label="Hide"
          title="Hide"
          onClick={() => void api.setupBarDismiss()}
        >
          ✕
        </Button>
      </div>
    </div>
  );
}
