import { invoke } from "@tauri-apps/api/core";
import {
  disable as disableAutostart,
  enable as enableAutostart,
  isEnabled as isAutostartEnabled,
} from "@tauri-apps/plugin-autostart";
import { useEffect, useState } from "react";

import {
  DEFAULT_SETTINGS,
  type Screen,
  type SettingsValues,
  getSettings,
  setSettings,
} from "../utils/config";
import { AccountCard } from "./settings/AccountCard";
import { ScreenWindowCard } from "./settings/ScreenWindowCard";
import { StartupCard } from "./settings/StartupCard";
import { StatusCard } from "./settings/StatusCard";
import { WhereToShowCard } from "./settings/WhereToShowCard";
import { useHostReachability } from "./settings/hooks";
import type { MonitorInfo } from "./settings/types";

type Props = {
  rootUrl: string;
  screen: Screen;
  onChangeScreen: () => void;
  onLoggedOut: () => void;
};

export function PairedSettings({
  rootUrl,
  screen,
  onChangeScreen,
  onLoggedOut,
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [values, setValues] = useState<SettingsValues>(DEFAULT_SETTINGS);
  const [formError, setFormError] = useState<string | null>(null);

  const { status: hostStatus, error: hostError } = useHostReachability(rootUrl);

  // Load monitors + persisted settings + actual autostart state on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mons = await invoke<MonitorInfo[]>("list_monitors");
        const stored = await getSettings();
        // Authoritative source for autostart is the OS plugin
        const autostart = await isAutostartEnabled().catch(() => false);
        if (cancelled) return;
        setMonitors(mons);
        setValues({ ...stored, autostart });
        setLoaded(true);
      } catch (e) {
        if (cancelled) return;
        setFormError(`Failed to load settings: ${String(e)}`);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyMonitor = async (monitor: string) => {
    const next = { ...values, monitor };
    setValues(next);
    setFormError(null);
    try {
      await setSettings(next);
      // "current" means leave the window wherever it is. No Rust call.
      if (monitor !== "current") {
        await invoke("apply_monitor", { monitorName: monitor });
      }
    } catch (e) {
      setFormError(`Failed to apply monitor: ${String(e)}`);
    }
  };

  const applyAutostart = async (autostart: boolean) => {
    setValues((v) => ({ ...v, autostart }));
    setFormError(null);
    try {
      if (autostart) {
        await enableAutostart();
      } else {
        await disableAutostart();
      }
      await setSettings({ ...values, autostart });
    } catch (e) {
      setFormError(`Failed to toggle autostart: ${String(e)}`);
      // Re-sync to the OS plugin so the checkbox doesn't lie.
      const actual = await isAutostartEnabled().catch(() => !autostart);
      setValues((v) => ({ ...v, autostart: actual }));
    }
  };

  const applyHostReachable = async (requireHostReachable: boolean) => {
    const next = { ...values, requireHostReachable };
    setValues(next);
    setFormError(null);
    try {
      await setSettings(next);
    } catch (e) {
      setFormError(`Failed to save: ${String(e)}`);
    }
  };

  if (!loaded) {
    return (
      <div className="settings-loading">
        <span>Loading settings…</span>
      </div>
    );
  }

  return (
    <div className="settings">
      <header className="settings-header">
        <h1>Settings</h1>
        <p className="settings-sub">TheOpenPresenter Screen</p>
      </header>

      <StatusCard
        rootUrl={rootUrl}
        hostStatus={hostStatus}
        hostError={hostError}
        screen={screen}
      />

      <ScreenWindowCard />

      <WhereToShowCard
        monitors={monitors}
        value={values.monitor}
        onChange={applyMonitor}
      />

      <StartupCard
        autostart={values.autostart}
        requireHostReachable={values.requireHostReachable}
        onAutostartChange={applyAutostart}
        onHostReachableChange={applyHostReachable}
      />

      <AccountCard onChangeScreen={onChangeScreen} onLoggedOut={onLoggedOut} />

      {formError && (
        <div className="settings-form-error" role="alert">
          {formError}
        </div>
      )}
    </div>
  );
}
