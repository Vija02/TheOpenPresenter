import { useEffect, useState } from "react";

import { type UnlistenFn, listen } from "../bridge/ipc";
import { type Screen, getRootUrl, getScreen } from "../utils/config";
import { PairedSettings } from "./PairedSettings";
import { ScreenPicker } from "./ScreenPicker";
import { Setup } from "./Setup";

type Stage = "loading" | "login" | "picker" | "paired";

type HostWait = {
  status: "waiting" | "ready";
  attempt?: number;
  rootUrl?: string;
};

export function Settings() {
  const rootUrl = getRootUrl();
  const [stage, setStage] = useState<Stage>("loading");
  const [screen, setScreen] = useState<Screen | null>(null);
  const [hostWait, setHostWait] = useState<HostWait | null>(null);

  useEffect(() => {
    let cancelled = false;
    getScreen()
      .then((s) => {
        if (cancelled) return;
        if (s) {
          setScreen(s);
          setStage("paired");
        } else {
          setStage("picker");
        }
      })
      .catch(() => {
        if (!cancelled) setStage("picker");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Reachability banner
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    listen<HostWait>("host-wait", (e) => {
      setHostWait(e.payload);
    })
      .then((u) => {
        unlisten = u;
      })
      .catch(() => {});
    return () => {
      unlisten?.();
    };
  }, []);

  const banner =
    hostWait?.status === "waiting" ? (
      <div className="host-wait-banner" role="status">
        <strong>Waiting for host…</strong>
        <span>
          {hostWait.rootUrl ?? rootUrl} hasn't responded yet (attempt{" "}
          {hostWait.attempt}). Retrying every 5 seconds.
        </span>
      </div>
    ) : null;

  let content;
  if (stage === "loading") {
    content = (
      <div className="settings-loading">
        <span>Loading…</span>
      </div>
    );
  } else if (stage === "login") {
    content = <Setup onLoggedIn={() => setStage("picker")} />;
  } else if (stage === "picker") {
    content = (
      <ScreenPicker
        onNeedLogin={() => setStage("login")}
        onSelected={(s) => {
          setScreen(s);
          setStage("paired");
        }}
      />
    );
  } else if (!screen) {
    content = (
      <div className="settings-loading">
        <span>Loading…</span>
      </div>
    );
  } else {
    content = (
      <PairedSettings
        rootUrl={rootUrl}
        screen={screen}
        onChangeScreen={() => setStage("picker")}
        onLoggedOut={() => {
          setScreen(null);
          setStage("login");
        }}
      />
    );
  }

  return (
    <>
      {banner}
      {content}
    </>
  );
}
