import { Button, Switch } from "@repo/ui";
import { useCallback, useEffect, useState } from "react";

import {
  type ClickerKey,
  type ClickerPress,
  type ClickerStatus,
  type ClickerTestPress,
  type ClickerTestResult,
  type ListedScreen,
  api,
  listen,
} from "../bridge/ipc";

const KEY_LABEL: Record<ClickerKey, string> = {
  PREV: "Previous",
  NEXT: "Next",
};

const PERMISSION_COMMAND = "sudo usermod -aG input $USER";

const message = (err: unknown) =>
  err instanceof Error ? err.message : String(err);

/** A presentation clicker moving one virtual screen's slides. */
export function Clicker() {
  const [status, setStatus] = useState<ClickerStatus | null>(null);
  const [screens, setScreens] = useState<ListedScreen[]>([]);
  const [finding, setFinding] = useState(false);
  const [lastPress, setLastPress] = useState<ClickerPress | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const refresh = useCallback(() => {
    api
      .clickerStatus()
      .then(setStatus)
      .catch((err) => setProblem(message(err)));
    api
      .virtualScreens()
      .then(setScreens)
      .catch(() => setScreens([]));
  }, []);

  useEffect(() => {
    refresh();
    const offs = [
      listen("clicker:changed", refresh),
      listen("screens:changed", refresh),
      listen<ClickerPress>("clicker:press", setLastPress),
    ];
    return () => offs.forEach((off) => off());
  }, [refresh]);

  const save = async (patch: Parameters<typeof api.saveClicker>[0]) => {
    setProblem(null);
    try {
      await api.saveClicker(patch);
    } catch (err) {
      setProblem(message(err));
    }
    refresh();
  };

  return (
    <section className="panel-body">
      <h2>Capture clicker</h2>
      <p className="muted">
        Capture a presentation clicker focus so that navigating through slide will always work for
        your speaker regardless of what you are doing on the PC.
      </p>

      {status === null ? (
        <p className="muted">Loading…</p>
      ) : !status.supported ? (
        <p className="muted">{status.reason}</p>
      ) : (
        <>
          <label className="screen-login-item">
            <Switch
              checked={status.config.enabled}
              onCheckedChange={(enabled) => {
                void save({ enabled });
                if (enabled && !status.config.device) setFinding(true);
                if (!enabled) setFinding(false);
              }}
            />
            <span>
              Use a presentation clicker
              <span className="muted small">
                Its next and previous buttons move the slides you choose, even
                when another window is in front. While
                it&apos;s on, the clicker does nothing else on this computer.
              </span>
            </span>
          </label>

          {status.notice && !status.config.enabled && (
            <p className="small clicker-notice">{status.notice}</p>
          )}

          {status.config.enabled && (
            <div className="monitor-panel">
              <div className="monitor-panel-head clicker-head">
                <span className="screen-row-text">
                  <span className="org-row-name">
                    {status.config.device?.name ?? "No clicker chosen"}
                  </span>
                  {!finding && <StateLine status={status} />}
                </span>
                {!finding && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFinding(true)}
                  >
                    {status.config.device ? "Change" : "Find my clicker"}
                  </Button>
                )}
              </div>

              {finding ? (
                <FindClicker
                  current={status.config.device?.id ?? null}
                  onCancel={() => setFinding(false)}
                  onChoose={async (device) => {
                    setFinding(false);
                    setLastPress(null);
                    await save({ device });
                  }}
                />
              ) : (
                <div className="monitor-panel-form">
                  {status.state === "denied" && <PermissionHelp />}

                  <label className="field">
                    <span>Controls</span>
                    <select
                      value={status.target ?? ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Arrow keys on a focused select change the choice,
                        // which is the first thing people press to try it.
                        e.currentTarget.blur();
                        if (!value) return;
                        void save(
                          value === "project"
                            ? { target: "project" }
                            : { target: "screen", screenId: value },
                        );
                      }}
                    >
                      {status.target === null && (
                        <option value="">Choose what it controls</option>
                      )}
                      <option value="project">
                        The project open in TheOpenPresenter
                      </option>
                      {screens.length > 0 && (
                        <optgroup label="Virtual screens">
                          {screens.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.screenName || s.screenSlug}
                              {s.orgName ? ` · ${s.orgName}` : ""}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </label>
                  <p className="muted small clicker-target-note">
                    {status.target === "project"
                      ? status.openProject
                        ? `Moves the slides of ${status.openProject.name || "the open project"}.`
                        : "Moves the slides of whichever project is open. No project is open right now."
                      : status.target === null
                        ? "Pick the open project, or a virtual screen this computer shows."
                        : "Moves whatever project is on that virtual screen."}
                  </p>

                  {status.state === "listening" && (
                    <p className="small clicker-last" data-ok={lastPress?.ok}>
                      {lastPress === null
                        ? "Press next or previous to check it works."
                        : lastPress.ok
                          ? `${KEY_LABEL[lastPress.key]} → ${lastPress.message}`
                          : `${KEY_LABEL[lastPress.key]} didn't go through: ${lastPress.message}`}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {problem && <p className="problem">{problem}</p>}
    </section>
  );
}

function StateLine({
  status,
}: {
  status: Extract<ClickerStatus, { supported: true }>;
}) {
  const [text, state] =
    status.state === "listening"
      ? status.grabbed
        ? ["Connected. Only TheOpenPresenter receives its presses", "open"]
        : [
            "Connected, but couldn't take it over: its presses also reach the window in front",
            "waiting",
          ]
      : status.state === "waiting"
        ? ["Not plugged in. It's picked up when it's connected", "waiting"]
        : status.state === "denied"
          ? ["Can't read it", "failed"]
          : ["Find your clicker to start", "closed"];
  return (
    <span className="small screen-row-state" data-state={state}>
      {text}
    </span>
  );
}

function PermissionHelp() {
  return (
    <div className="clicker-permission small">
      <span>
        TheOpenPresenter needs permission to read input devices. Run this in a
        terminal, then sign out and back in:
      </span>
      <span className="clicker-command">
        <code>{PERMISSION_COMMAND}</code>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => void api.copyText(PERMISSION_COMMAND)}
        >
          Copy
        </Button>
      </span>
    </div>
  );
}

type Heard = ClickerTestPress & { count: number; at: number };

/** Press the clicker; whichever device sent it is the one to pick. */
function FindClicker({
  current,
  onCancel,
  onChoose,
}: {
  current: string | null;
  onCancel: () => void;
  onChoose: (device: { id: string; name: string }) => void;
}) {
  const [result, setResult] = useState<ClickerTestResult | null>(null);
  const [heard, setHeard] = useState<Heard[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const off = listen<ClickerTestPress>("clicker:test-press", (press) =>
      setHeard((list) => {
        const before = list.find((h) => h.device.id === press.device.id);
        const next: Heard = {
          ...press,
          count: (before?.count ?? 0) + 1,
          at: Date.now(),
        };
        // Latest first: the device just pressed is the likely answer.
        return [next, ...list.filter((h) => h !== before)];
      }),
    );
    api
      .startClickerTest()
      .then(setResult)
      .catch((err) => setError(message(err)));
    return () => {
      off();
      void api.stopClickerTest().catch(() => {});
    };
  }, []);

  const blocked = result !== null && result.opened === 0;

  return (
    <div className="monitor-panel-form">
      <div className="screen-picker-head">
        <span className="small">
          {blocked
            ? "Couldn't listen to any input device."
            : "Press next or previous on your clicker…"}
        </span>
        <Button variant="ghost" size="xs" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      {blocked && result.denied && <PermissionHelp />}
      {blocked && !result.denied && (
        <p className="muted small">No keyboards or clickers were found.</p>
      )}

      {heard.length > 0 && (
        <ul className="org-rows clicker-heard">
          {heard.map((h, i) => (
            <li key={h.device.id} className="org-row" data-latest={i === 0}>
              <span className="screen-row-text">
                <span className="org-row-name">{h.device.name}</span>
                <span className="muted small">
                  {/* Keyed by time so the line flashes on every press. */}
                  <span key={h.at} className="clicker-flash">
                    {KEY_LABEL[h.key]}
                  </span>
                  {h.count > 1 && ` · ${h.count} presses`}
                  {h.device.id === current && " · in use now"}
                </span>
              </span>
              <Button
                size="sm"
                variant={i === 0 ? "default" : "outline"}
                onClick={() => onChoose(h.device)}
              >
                Use this one
              </Button>
            </li>
          ))}
        </ul>
      )}

      {!blocked && (
        <p className="muted small">
          Arrow and page keys on a keyboard show up here too. Pick the clicker,
          not your keyboard: TheOpenPresenter takes over the device you pick,
          so it stops working in other apps while this is on.
        </p>
      )}

      {error && <p className="problem">{error}</p>}
    </div>
  );
}
