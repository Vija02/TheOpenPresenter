import { useCallback, useEffect, useState } from "react";

import { invoke } from "../bridge/ipc";
import { type Screen, getRootUrl, setScreen } from "../utils/config";

type ScreenItem = { id: string; name: string; slug: string };
type OrgItem = {
  id: string;
  name: string;
  slug: string;
  screens: ScreenItem[];
};
type ScreenListResult = { loggedIn: boolean; orgs: OrgItem[] };

type State =
  | { status: "loading" }
  | { status: "ready"; orgs: OrgItem[] }
  | { status: "error"; message: string };

type Props = {
  onNeedLogin: () => void;
  onSelected: (screen: Screen) => void;
};

export function ScreenPicker({ onNeedLogin, onSelected }: Props) {
  const rootUrl = getRootUrl();
  const [state, setState] = useState<State>({ status: "loading" });
  const [picking, setPicking] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const res = await invoke<ScreenListResult>("list_screens", { rootUrl });
      if (!res.loggedIn) {
        onNeedLogin();
        return;
      }
      setState({ status: "ready", orgs: res.orgs });
    } catch (e) {
      setState({ status: "error", message: String(e) });
    }
  }, [rootUrl, onNeedLogin]);

  useEffect(() => {
    void load();
  }, [load]);

  const select = async (org: OrgItem, screen: ScreenItem) => {
    setPicking(screen.id);
    setPickError(null);
    const value: Screen = {
      orgSlug: org.slug,
      screenSlug: screen.slug,
      orgName: org.name,
      screenName: screen.name,
    };
    try {
      await setScreen(value);
      const renderUrl = `${rootUrl}/render/s/${encodeURIComponent(
        org.slug,
      )}/${encodeURIComponent(screen.slug)}`;
      await invoke("navigate_main", { url: renderUrl });
      onSelected(value);
    } catch (e) {
      setPickError(String(e));
      setPicking(null);
    }
  };

  if (state.status === "loading") {
    return (
      <div className="settings-loading">
        <span>Loading your screens…</span>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="picker">
        <header className="settings-header">
          <h1>Select a screen</h1>
          <p className="settings-sub">Couldn't load your screens</p>
        </header>
        <section className="settings-card">
          <span className="settings-error settings-block">{state.message}</span>
          <div className="settings-actions" style={{ marginTop: 12 }}>
            <button className="settings-btn" onClick={() => void load()}>
              Retry
            </button>
          </div>
        </section>
      </div>
    );
  }

  const orgsWithScreens = state.orgs.filter((o) => o.screens.length > 0);

  return (
    <div className="picker">
      <header className="settings-header">
        <h1>Select a screen</h1>
        <p className="settings-sub">
          Pick which screen this device should display.
        </p>
      </header>

      {pickError && (
        <section className="settings-card">
          <span className="settings-error settings-block">{pickError}</span>
        </section>
      )}

      {orgsWithScreens.length === 0 ? (
        <section className="settings-card">
          <p className="settings-help" style={{ margin: 0 }}>
            {state.orgs.length === 0
              ? "You don't have access to any organizations with screens."
              : "No screens yet. Create one in the web app, then come back and refresh."}
          </p>
          <div className="settings-actions" style={{ marginTop: 12 }}>
            <button className="settings-btn" onClick={() => void load()}>
              Refresh
            </button>
          </div>
        </section>
      ) : (
        orgsWithScreens.map((org) => (
          <section className="settings-card" key={org.id}>
            <h2>{org.name}</h2>
            <div className="picker-list">
              {org.screens.map((screen) => (
                <button
                  key={screen.id}
                  type="button"
                  className="picker-item"
                  disabled={picking !== null}
                  onClick={() => select(org, screen)}
                >
                  <span className="picker-item-name">{screen.name}</span>
                  <span className="picker-item-action">
                    {picking === screen.id ? "Selecting…" : "Select"}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
