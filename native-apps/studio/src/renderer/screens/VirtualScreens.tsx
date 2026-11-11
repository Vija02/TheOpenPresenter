import { Button, Switch } from "@repo/ui";
import { CloudIcon, MonitorIcon, ServerIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  type CatalogOrganization,
  type CatalogScreen,
  type ListedScreen,
  type LoginItemState,
  type MonitorInfo,
  type ScreenCatalog,
  type ScreenSource,
  type ScreenState,
  type VirtualScreen,
  api,
  listen,
  platform,
} from "../bridge/ipc";

const sourceKey = (source: ScreenSource) =>
  source.kind === "local" ? "local" : source.host;

const STATE_LABEL: Record<ScreenState, string> = {
  closed: "Not showing",
  open: "Showing",
  "waiting-display": "Waiting for its monitor",
  "waiting-server": "Waiting for this computer's server",
  "waiting-network": "Waiting for its server to be reachable",
  failed: "Couldn't load, trying again",
};

const message = (err: unknown) =>
  (err instanceof Error ? err.message : String(err)).replace(
    /^Error invoking remote method '[^']+': (Error: )?/,
    "",
  );

const screenTitle = (s: VirtualScreen) => s.screenName || s.screenSlug;

/** What is saved for a screen, without what listing adds. */
const toConfig = ({
  state: _state,
  displayId: _displayId,
  sourceLabel: _sourceLabel,
  ...config
}: ListedScreen): VirtualScreen => config;

type Rect = { x: number; y: number; width: number; height: number };

/** A tile on the map: a connected monitor, or the shadow of an unplugged one. */
type Slot =
  | {
      kind: "monitor";
      key: string;
      rect: Rect;
      monitor: MonitorInfo;
      number: number;
      screen: ListedScreen | null;
    }
  | { kind: "ghost"; key: string; rect: Rect; screen: ListedScreen };

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;

/**
 * Connected monitors where they are, then each screen whose monitor is
 * unplugged where that monitor was, or beside the rest if something is there.
 */
function layout(monitors: MonitorInfo[], screens: ListedScreen[]): Slot[] {
  const slots: Slot[] = monitors.map((monitor, i) => ({
    kind: "monitor",
    key: monitor.id,
    rect: monitor,
    monitor,
    number: i + 1,
    screen: screens.find((s) => s.displayId === monitor.id) ?? null,
  }));
  const primary = monitors.find((m) => m.isPrimary) ?? monitors[0];
  for (const screen of screens) {
    if (screen.displayId !== null) continue;
    let rect: Rect = screen.monitorBounds ?? {
      x: 0,
      y: 0,
      width: primary?.width ?? 1920,
      height: primary?.height ?? 1080,
    };
    if (!screen.monitorBounds || slots.some((s) => overlaps(s.rect, rect))) {
      const right = Math.max(0, ...slots.map((s) => s.rect.x + s.rect.width));
      const top = Math.min(...slots.map((s) => s.rect.y), 0);
      rect = { ...rect, x: right, y: top };
    }
    slots.push({ kind: "ghost", key: `ghost:${screen.id}`, rect, screen });
  }
  return slots;
}

/** Screens this computer shows by itself, one per monitor. */
export function VirtualScreens() {
  const [screens, setScreens] = useState<ListedScreen[] | null>(null);
  const [monitors, setMonitors] = useState<MonitorInfo[] | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [launchAtLogin, setLaunchAtLogin] = useState<LoginItemState | null>(
    null,
  );
  const [problem, setProblem] = useState<string | null>(null);

  const refresh = useCallback(() => {
    api
      .virtualScreens()
      .then(setScreens)
      .catch((err) => setProblem(message(err)));
    api
      .monitors()
      .then(setMonitors)
      .catch(() => setMonitors([]));
  }, []);

  useEffect(() => {
    refresh();
    api
      .launchAtLogin()
      .then(setLaunchAtLogin)
      .catch(() => {});
    return listen("screens:changed", refresh);
  }, [refresh]);

  const run = async (action: () => Promise<unknown>) => {
    setProblem(null);
    try {
      await action();
    } catch (err) {
      setProblem(message(err));
    }
    refresh();
  };

  const slots = monitors && screens ? layout(monitors, screens) : null;
  // Start on the primary monitor, and move off one that went away.
  const selected =
    slots?.find((s) => s.key === selectedKey) ??
    slots?.find((s) => s.kind === "monitor" && s.monitor.isPrimary) ??
    slots?.[0] ??
    null;
  const freeMonitors = (slots ?? []).flatMap((s) =>
    s.kind === "monitor" && !s.screen ? [s] : [],
  );

  return (
    <section className="panel-body">
      <h2>Virtual screens</h2>
      <p className="muted">
        Connect a monitor on this computer to a virtual screen. It opens
        fullscreen on that monitor and shows whatever project is assigned to the
        virtual screen from the app. Each monitor connects to one virtual
        screen.
      </p>

      {slots === null ? (
        <p className="muted">Loading…</p>
      ) : slots.length === 0 ? (
        <p className="muted">No monitors detected.</p>
      ) : (
        <>
          <MonitorMap
            slots={slots}
            selectedKey={selected?.key ?? null}
            onSelect={(slot) => setSelectedKey(slot.key)}
          />
          {selected?.kind === "monitor" && (
            <MonitorPanel
              key={selected.key}
              slot={selected}
              run={run}
              onChanged={refresh}
            />
          )}
          {selected?.kind === "ghost" && (
            <div className="monitor-panel" key={selected.key}>
              <div className="monitor-panel-head">
                <span className="monitor-panel-number" data-ghost>
                  –
                </span>
                <span className="screen-row-text">
                  <span className="org-row-name">
                    {selected.screen.monitorName ?? "A monitor"} isn&apos;t
                    connected
                  </span>
                  <span className="muted small">
                    The virtual screen opens again when it&apos;s plugged back
                    in.
                  </span>
                </span>
              </div>
              <ScreenDetails screen={selected.screen} run={run}>
                {freeMonitors.map((m) => (
                  <Button
                    key={m.key}
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void run(() =>
                        api.saveScreen({
                          ...toConfig(selected.screen),
                          monitorId: m.monitor.id,
                          monitorName: m.monitor.name,
                        }),
                      )
                    }
                  >
                    Move to monitor {m.number}
                  </Button>
                ))}
              </ScreenDetails>
            </div>
          )}
        </>
      )}

      {launchAtLogin !== null && (
        <label className="screen-login-item">
          <Switch
            checked={
              launchAtLogin.status === "on" ||
              launchAtLogin.status === "needs-approval"
            }
            disabled={launchAtLogin.status === "unavailable"}
            onCheckedChange={(checked) =>
              void run(async () =>
                setLaunchAtLogin(await api.setLaunchAtLogin(checked)),
              )
            }
          />
          <span>
            Start TheOpenPresenter when this computer starts
            <span className="muted small">
              {launchAtLogin.status === "unavailable"
                ? launchAtLogin.reason
                : "With auto-open, screens come up without anyone at the computer."}
              {launchAtLogin.status !== "unavailable" &&
                platform() === "linux" &&
                " Needs a desktop that runs autostart apps, such as GNOME, KDE or Xfce."}
            </span>
            {launchAtLogin.status === "needs-approval" && (
              <span className="small screen-login-approval">
                Allow it in System Settings → Login Items.{" "}
                <Button
                  variant="link"
                  size="xs"
                  onClick={(e) => {
                    e.preventDefault();
                    void run(() => api.openLoginItems());
                  }}
                >
                  Open Login Items
                </Button>
              </span>
            )}
          </span>
        </label>
      )}

      {problem && <p className="problem">{problem}</p>}
    </section>
  );
}

/** The monitors as they are arranged, like the present picker in the app. */
function MonitorMap({
  slots,
  selectedKey,
  onSelect,
}: {
  slots: Slot[];
  selectedKey: string | null;
  onSelect: (slot: Slot) => void;
}) {
  const rects = slots.map((s) => s.rect);
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const width = Math.max(...rects.map((r) => r.x + r.width)) - minX;
  const height = Math.max(...rects.map((r) => r.y + r.height)) - minY;

  return (
    <div className="monitor-map">
      <div
        className="monitor-map-canvas"
        style={{
          width: `min(100cqw, calc(100cqh * ${width / height}))`,
          aspectRatio: `${width} / ${height}`,
        }}
      >
        {slots.map((slot) => {
          const s = slot.screen;
          const ghost = slot.kind === "ghost";
          return (
            <div
              key={slot.key}
              className="monitor-map-slot"
              style={{
                left: `${((slot.rect.x - minX) / width) * 100}%`,
                top: `${((slot.rect.y - minY) / height) * 100}%`,
                width: `${(slot.rect.width / width) * 100}%`,
                height: `${(slot.rect.height / height) * 100}%`,
              }}
            >
              <button
                type="button"
                className="monitor-tile"
                aria-pressed={slot.key === selectedKey}
                data-assigned={!!s}
                data-ghost={ghost || undefined}
                title={
                  slot.kind === "monitor"
                    ? `${slot.monitor.name} · ${slot.monitor.width}×${slot.monitor.height}`
                    : `${slot.screen.monitorName ?? "Monitor"} · not connected`
                }
                onClick={() => onSelect(slot)}
              >
                <span className="monitor-tile-number">
                  {slot.kind === "monitor" ? slot.number : "–"}
                </span>
                <span className="monitor-tile-screen">
                  {s ? screenTitle(s) : "No virtual screen"}
                </span>
                {ghost ? (
                  <span className="monitor-tile-state">Not connected</span>
                ) : (
                  s &&
                  s.state !== "closed" && (
                    <span className="monitor-tile-state" data-state={s.state}>
                      {STATE_LABEL[s.state]}
                    </span>
                  )
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** A connected virtual screen: where it comes from, and what to do with it. */
function ScreenDetails({
  screen,
  run,
  children,
}: {
  screen: ListedScreen;
  run: (action: () => Promise<unknown>) => Promise<void>;
  /** Actions only some places offer. */
  children?: React.ReactNode;
}) {
  const showing = screen.state !== "closed";
  return (
    <div className="monitor-panel-screen">
      <div className="screen-details-main">
        <span className="screen-row-text">
          <span className="screen-details-title">
            <span className="org-row-name">{screenTitle(screen)}</span>
            <span className="small screen-row-state" data-state={screen.state}>
              {STATE_LABEL[screen.state]}
            </span>
          </span>
          <span className="muted small">
            {[screen.orgName || screen.orgSlug, screen.sourceLabel]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        <div className="monitor-panel-actions">
          {showing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void run(() => api.closeScreen(screen.id))}
            >
              Close
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => void run(() => api.openScreen(screen.id))}
            >
              Show
            </Button>
          )}
          {children}
          <Button
            variant="ghost"
            size="sm"
            className="org-row-remove"
            onClick={() => void run(() => api.removeScreen(screen.id))}
          >
            Remove
          </Button>
        </div>
      </div>
      <label className="screen-row-launch screen-details-launch">
        <Switch
          size="sm"
          checked={screen.openOnLaunch}
          onCheckedChange={(checked) =>
            void run(() =>
              api.saveScreen({ ...toConfig(screen), openOnLaunch: checked }),
            )
          }
        />
        <span className="small">Open when TheOpenPresenter starts</span>
      </label>
    </div>
  );
}

/** One monitor: the virtual screen it shows, or a way to connect one. */
function MonitorPanel({
  slot,
  run,
  onChanged,
}: {
  slot: Extract<Slot, { kind: "monitor" }>;
  run: (action: () => Promise<unknown>) => Promise<void>;
  onChanged: () => void;
}) {
  const [changing, setChanging] = useState(false);
  const { monitor, screen } = slot;

  return (
    <div className="monitor-panel">
      <div className="monitor-panel-head">
        <span className="monitor-panel-number">{slot.number}</span>
        <span className="screen-row-text">
          <span className="org-row-name">{monitor.name}</span>
          <span className="muted small">
            {monitor.width}×{monitor.height}
            {monitor.isPrimary && " · Primary"}
          </span>
        </span>
      </div>

      {screen && !changing ? (
        <ScreenDetails screen={screen} run={run}>
          <Button variant="outline" size="sm" onClick={() => setChanging(true)}>
            Change
          </Button>
        </ScreenDetails>
      ) : (
        <ScreenPicker
          monitor={monitor}
          initial={screen}
          onCancel={screen ? () => setChanging(false) : undefined}
          onSaved={() => {
            setChanging(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

const sameScreen = (a: VirtualScreen, b: CatalogScreen) =>
  sourceKey(a.source) === sourceKey(b.source) &&
  a.orgSlug === b.orgSlug &&
  a.screenSlug === b.slug;

/** Every screen the accounts and this computer have, grouped like Accounts. */
function ScreenPicker({
  monitor,
  initial,
  onCancel,
  onSaved,
}: {
  monitor: MonitorInfo;
  initial: VirtualScreen | null;
  onCancel?: () => void;
  onSaved: () => void;
}) {
  const [catalog, setCatalog] = useState<ScreenCatalog | null>(null);
  const [openOnLaunch, setOpenOnLaunch] = useState(
    initial?.openOnLaunch ?? true,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .screenCatalog()
      .then(setCatalog)
      .catch((err) => {
        setCatalog({ groups: [], problems: [] });
        setError(message(err));
      });
  }, []);

  const assign = async (org: CatalogOrganization, picked: CatalogScreen) => {
    const key = `${org.key}/${picked.slug}`;
    setBusy(key);
    setError(null);
    try {
      const saved = await api.saveScreen({
        id: initial?.id,
        source: picked.source,
        orgSlug: picked.orgSlug,
        screenSlug: picked.slug,
        orgName: org.name,
        screenName: picked.name,
        monitorId: monitor.id,
        monitorName: monitor.name,
        openOnLaunch,
      });
      // Show a new screen straight away; a changed one follows by itself.
      if (!initial) await api.openScreen(saved.id);
      onSaved();
    } catch (err) {
      setError(message(err));
      setBusy(null);
    }
  };

  return (
    <div className="monitor-panel-form">
      <div className="screen-picker-head">
        <span className="small">
          {initial
            ? "Connect a different virtual screen"
            : "Choose a virtual screen to connect"}
        </span>
        {onCancel && (
          <Button
            variant="ghost"
            size="xs"
            disabled={busy !== null}
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
      </div>

      {catalog === null ? (
        <p className="muted small">Finding screens…</p>
      ) : catalog.groups.length === 0 ? (
        <p className="muted small">
          No accounts to pick from. Sign in under Settings → Account, or create
          an organization on this computer.
        </p>
      ) : (
        catalog.groups.map((group) => (
          <div key={group.key} className="org-group">
            <div className="org-group-head">
              <p className="org-group-title">
                {group.account === null ? (
                  <MonitorIcon className="size-4" />
                ) : group.isCloud ? (
                  <CloudIcon className="size-4" />
                ) : (
                  <ServerIcon className="size-4" />
                )}
                {group.label}
                {group.account && (
                  <span className="muted"> · {group.account}</span>
                )}
              </p>
            </div>
            <ul className="org-rows">
              {group.organizations.map((org) => (
                <li key={org.key} className="org-row screen-picker-org">
                  <span className="screen-picker-org-head">
                    <span className="org-row-name">{org.name}</span>
                    {org.syncedTo && (
                      <span className="org-row-sync" title={org.syncedTo}>
                        Synced to {org.syncedToLabel}
                      </span>
                    )}
                  </span>
                  {org.screens.length === 0 ? (
                    <span className="muted small">
                      No virtual screens yet. Create one under Virtual Screens
                      in the app.
                    </span>
                  ) : (
                    <span className="screen-picker-screens">
                      {org.screens.map((sc) => {
                        const key = `${org.key}/${sc.slug}`;
                        const current = !!initial && sameScreen(initial, sc);
                        return (
                          <Button
                            key={sc.slug}
                            variant={current ? "default" : "outline"}
                            size="sm"
                            aria-pressed={current}
                            disabled={busy !== null}
                            onClick={() =>
                              current ? onCancel?.() : void assign(org, sc)
                            }
                          >
                            {busy === key ? "Saving…" : sc.name}
                          </Button>
                        );
                      })}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}

      {catalog?.problems.map((p) => (
        <p key={p} className="muted small">
          Couldn&apos;t list {p}
        </p>
      ))}

      <label className="screen-login-item">
        <Switch
          checked={openOnLaunch}
          disabled={busy !== null}
          onCheckedChange={setOpenOnLaunch}
        />
        <span>Open when TheOpenPresenter starts</span>
      </label>

      {error && <p className="problem">{error}</p>}
    </div>
  );
}
