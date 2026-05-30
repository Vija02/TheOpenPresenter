import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";

import { useScreenMute, useScreenVisibility } from "./hooks";

type Action = "show" | "hide" | "refresh";

export function ScreenWindowCard() {
  const visible = useScreenVisibility();
  const { supported: muteSupported, muted } = useScreenMute();
  const [busy, setBusy] = useState<Action | null>(null);
  const [muteBusy, setMuteBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAction = async (kind: Action, cmd: string) => {
    setBusy(kind);
    setError(null);
    try {
      await invoke(cmd);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  const toggleMute = async () => {
    setMuteBusy(true);
    setError(null);
    try {
      await invoke("set_screen_muted", { muted: !(muted ?? false) });
    } catch (e) {
      setError(String(e));
    } finally {
      setMuteBusy(false);
    }
  };

  return (
    <section className="settings-card">
      <h2>Screen window</h2>

      <div className="settings-row">
        <span className="settings-row-label">State</span>
        <span className={`pill pill-${visible === true ? "ok" : "muted"}`}>
          {visible === true
            ? "Showing"
            : visible === false
              ? "Hidden"
              : "Unknown"}
        </span>
      </div>

      {muteSupported && (
        <>
          <div className="settings-row">
            <span className="settings-row-label">Audio</span>
            <span className={`pill pill-${muted === false ? "ok" : "muted"}`}>
              {muted === true ? "Muted" : muted === false ? "On" : "Unknown"}
            </span>
            <button
              className="settings-btn"
              onClick={toggleMute}
              disabled={muteBusy}
            >
              {muteBusy ? "…" : muted ? "Unmute" : "Mute"}
            </button>
          </div>
          <p className="settings-help" style={{ margin: "0 0 12px" }}>
            The screen is always muted while hidden; this controls audio when
            it's shown.
          </p>
        </>
      )}

      <div className="settings-actions">
        <button
          className="settings-btn"
          onClick={() => runAction("show", "show_screen")}
          disabled={busy !== null || visible === true}
        >
          {busy === "show" ? "Opening…" : "Open"}
        </button>
        <button
          className="settings-btn"
          onClick={() => runAction("hide", "hide_screen")}
          disabled={busy !== null || visible === false}
        >
          {busy === "hide" ? "Closing…" : "Close"}
        </button>
        <button
          className="settings-btn"
          onClick={() => runAction("refresh", "refresh_screen")}
          disabled={busy !== null}
        >
          {busy === "refresh" ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && <span className="settings-error settings-block">{error}</span>}
    </section>
  );
}
