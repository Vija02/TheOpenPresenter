import { useEffect, useState } from "react";

import { type Screen, getRootUrl, getScreen } from "../utils/config";
import { PairedSettings } from "./PairedSettings";
import { ScreenPicker } from "./ScreenPicker";
import { Setup } from "./Setup";

type Stage = "loading" | "login" | "picker" | "paired";

export function Settings() {
  const rootUrl = getRootUrl();
  const [stage, setStage] = useState<Stage>("loading");
  const [screen, setScreen] = useState<Screen | null>(null);

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

  if (stage === "loading") {
    return (
      <div className="settings-loading">
        <span>Loading…</span>
      </div>
    );
  }

  if (stage === "login") {
    return <Setup onLoggedIn={() => setStage("picker")} />;
  }

  if (stage === "picker") {
    return (
      <ScreenPicker
        onNeedLogin={() => setStage("login")}
        onSelected={(s) => {
          setScreen(s);
          setStage("paired");
        }}
      />
    );
  }

  if (!screen) {
    return (
      <div className="settings-loading">
        <span>Loading…</span>
      </div>
    );
  }

  return (
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
