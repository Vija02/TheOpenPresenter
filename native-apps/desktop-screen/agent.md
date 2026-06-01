# agent.md — desktop-screen kiosk

Orientation for AI coding agents working in `native-apps/desktop-screen/`.
The `README.md` next door is for operators / end-users. **This file is for
agents** — the gotchas, conventions, and project-shaped knowledge that's
hard to discover by reading the code linearly.

## What this is

Tauri v2 desktop kiosk for TheOpenPresenter. Two webview windows
(`settings`, `main`) share a single React bundle (root dispatched by
`getCurrentWebviewWindow().label` in `main.tsx`). Rust does everything
authenticated; the webview only does *top-level* navigations to the
server, so the SameSite=Lax session cookie rides along.

## Where things live

### Rust — `src-tauri/src/`
- `lib.rs` — `run()` wires plugins, managed state, the tray, window event
  routing, and the invoke handler list. Most architectural decisions
  surface here.
- `state.rs` — typed wrappers for shared state (`PairingState`,
  `InitialMainUrl`, `MuteState`).
- `platform.rs` — Linux env fixups (WebKit DMABUF renderer disable in
  VMs; GStreamer feature-rank to promote the `va` hardware decoder over
  `avdec_h264` so HLS/MSE video doesn't fall back to software decode).
- `tray.rs` — system tray icon, menu, and the `screen-visibility` listener
  that keeps Show/Hide enabled-state honest.
- `window.rs` — settings + main window lifecycle (`set_screen_visible`,
  show/hide, `apply_stored_monitor`), mute via `with_webview`, and the
  Esc-to-hide GTK signal handler (`install_esc_handler`, Linux only).
- `monitor.rs` — display enumeration (`list_monitors`) and the
  cross-platform exit-fullscreen → reposition+resize → re-fullscreen
  sequence in `apply_monitor`.
- `pairing.rs` — QR-login SSE proxy.
- `session.rs` — cookie exchange (`establish_session`), GraphQL screen
  list (`list_screens`), logout (`clear_session`). Heavy macOS branches
  for reasons covered below.
- `host.rs` — reachability probe (`check_host`) + the gated-launch poller
  (`wait_for_host_and_show`).

### Frontend — `src/`
- `main.tsx` — label-based root dispatch + init sequence (`initRootUrl`,
  `initAutostart`, `initMonitor`).
- `components/MainScreen.tsx` — render host. Navigates to the remote URL
  via `navigate_main`; React unloads after that.
- `components/Settings.tsx` — stage router (loading → login → picker →
  paired). Owns the `host-wait` banner.
- `components/PairedSettings.tsx` — container for the paired state, owns
  form values + instant-apply handlers.
- `components/settings/*` — one file per Settings card; `hooks.ts` has
  the Tauri-event-driven live-state primitives (`useScreenVisibility`,
  `useScreenMute`, `useHostReachability`).
- `utils/config.ts` — single source of truth for config persistence.

## Build & verify

Commands you can run directly without user friction:
```sh
cd src-tauri && cargo check    # Rust type-check, fast incremental
npx tsc --noEmit               # TypeScript type-check
```

Commands the user prefers to run themselves (per their auto-memory):
```sh
npm run tauri dev      # full dev with HMR
npm run tauri build    # production binary
```

Don't auto-execute `tauri dev` / `tauri build` — the user often tests on
a different machine, and full builds are slow.

## Platform gotchas

### macOS (the biggest cluster)
WKWebView has **no public per-webview mute API**. To silence the kiosk on
"Hide screen", we destroy the render window (no live mute = no choice).
That cascades:

- The `main` window is **transient** on macOS — created on show, closed
  on hide (`create_main_window`).
- The session cookie can't persist in transient `main`, so a hidden
  `auth` helper window (`ensure_auth_window`) holds the jar. WKWebView's
  default data store is process-wide, so a fresh render window inherits
  the cookies the auth window holds.
- `session.rs` has three `cfg(target_os = "macos")` branches that route
  cookie I/O (read for GraphQL header, write on login, delete on logout)
  to `auth` instead of `main`. **Each branch traces back to the
  no-mute-API root cause** — don't refactor one without considering the
  others.

### Linux
- **Esc-to-hide** uses the GTK `key-press-event` signal on the main
  webview (`install_esc_handler`), **not** `tauri-plugin-global-shortcut`.
  The plugin uses `XGrabKey`, which Wayland intentionally doesn't expose.
  The GTK signal works on both X11 and Wayland.
- **System tray** uses StatusNotifierItem (appindicator) on most modern
  Linux DEs. The protocol doesn't distinguish left vs right click — *any*
  click opens the menu. `show_menu_on_left_click(false)` is honoured on
  macOS/Windows only. We compensate by keeping Show/Hide enabled-state in
  sync with visibility so the menu is unambiguous.
- **Tiling WMs** (i3, sway) ignore `set_position` for cross-monitor moves
  on already-mapped windows. We work around this generically (no
  WM-specific code) by applying geometry while the window is **hidden**
  in `apply_screen_visible`, then re-asserting fullscreen after the WM
  has mapped it. Don't replace this with `i3-msg` / Sway IPC.
- Mute uses `webkit2gtk::WebViewExt::set_is_muted` via `with_webview`.

### Windows
- Mute uses WebView2's `ICoreWebView2_8::SetIsMuted` via `with_webview`.
- Otherwise the most "Tauri-standard" path of the three.

## Persistence model

Single `tauri-plugin-store` file: **`config.json`**. Three top-level keys:

- `rootUrl` (string) — runtime-configured server URL. Default
  `https://theopenpresenter.com`.
- `screen` (object) — `{ orgSlug, screenSlug, orgName?, screenName?, id }`.
- `settings` (object) —
  `{ monitor, autostart, requireHostReachable }`.

**Don't add new top-level keys** without updating `src/utils/config.ts`
and the Rust readers (`host.rs::stored_root_url`,
`stored_require_host_reachable`, `window.rs::stored_monitor_pref`). There
are no longer separate `screen.json` / `settings.json` / `host.json`
files; old references are stale.

## Visibility invariant — single applier rule

The kiosk's visible/hidden state has three coupled side effects (audio
mute, monitor positioning, the `screen-visibility` event) and it's
easy to drive them out of sync if you change visibility from more than
one place. **`window::set_screen_visible(app, visible)` is the only
function that should change visibility.** It calls
`apply_screen_visible` (which applies mute + monitor + fullscreen as a
unit) and emits `screen-visibility`.

Concrete corollaries:

- Don't call `w.show()` / `w.hide()` / `w.close()` on the `main` window
  outside `apply_screen_visible`. The `CloseRequested` handler in
  `lib.rs` routes through `set_screen_visible(false)` for this reason.
- **Startup** drives the initial state explicitly. If autostart is on,
  `set_screen_visible(true)` (or the host-wait poller). If autostart is
  off, `set_screen_visible(false)` — without this, `tauri.conf.json`'s
  `visible: false` hides the *window* but the WebView2 / WebKit2GTK
  process is still alive, the React bundle still loads, MainScreen.tsx
  still auto-navigates to the kiosk URL, and the page autoplays audio
  from a hidden window. `set_screen_visible(false)` mutes the webview
  and emits the canonical event so the Settings UI doesn't start out
  claiming the kiosk is shown.
- **`apply_monitor`** must not change visibility. If the window is
  hidden, the new monitor pref is already in the store and
  `apply_stored_monitor` will read it on the next show — short-circuit
  early. If you do the exit-FS → reposition → re-enter-FS dance against
  a hidden window, `set_fullscreen(true)` un-hides it and you flash the
  kiosk on screen.
- **`clear_session`** routes through `set_screen_visible(false)` before
  doing cookie / navigation work. Don't call `w.hide()` + manually emit
  the event — the webview won't be muted and Settings hooks can desync.
- **Pairing gate.** `set_screen_visible(true)` is silently downgraded to
  `false` when no screen is paired (`screen.{orgSlug,screenSlug}` absent
  in the store). Otherwise autostart / host-wait / tray would pop the
  kiosk window on first boot to show MainScreen's "Not paired" filler
  on top of the Settings UI the user actually needs. Re-pairing
  doesn't auto-show the kiosk — the user clicks "Open screen" (or the
  tray) once paired, and the gate now lets it through.

## IPC event taxonomy

Emitted from Rust, consumed in React:

- `pairing-message` (string) — JSON payload of an SSE event from the
  login stream.
- `pairing-error` (string) — error string when the SSE breaks.
- `screen-visibility` (bool) — fires from every show/hide path. **Always
  emit via `set_screen_visible`**, never `w.show()` / `w.hide()`
  directly, or the tray + Settings UI desync.
- `screen-muted` (bool) — user's mute pref. Emitted from
  `set_screen_muted`.
- `host-wait` (`{ status: "waiting" | "ready", attempt?, rootUrl? }`) —
  emitted by the reachability gate poller.
- `monitors-changed` (`()`) — emitted by `monitor::watch_monitors` (a
  background task spawned in `lib.rs::setup`) whenever the OS monitor
  list signature changes (plug, unplug, resolution / arrangement
  change). Tauri v2 doesn't expose a cross-platform monitor-change
  event, so the watcher polls `available_monitors()` every ~2 seconds
  and diffs by `(name, width, height, x, y)`. The watcher also
  re-applies kiosk geometry when the kiosk is currently visible —
  `apply_stored_monitor` is a no-op when the saved monitor name no
  longer matches a connected output, so unplug + re-plug naturally
  re-snaps the window. Frontend listens via the `useMonitors` hook
  (`src/components/settings/hooks.ts`).

When adding new events, follow the `<noun>-<state>` pattern and emit them
through a single helper (like `set_screen_visible` does) so callers can't
skip the emit.

## Settings = instant-commit

No Save button. Every Settings control writes to the store *and* applies
its side effect in one flow. On failure, the UI rolls back to the
authoritative source (e.g. `isAutostartEnabled()` for the autostart
checkbox). To add a new setting:

1. Extend `SettingsValues` + `DEFAULT_SETTINGS` in `utils/config.ts`.
2. Add a card under `components/settings/`.
3. Add an `apply<X>` handler in `PairedSettings.tsx` (optimistic update →
   persist → side effect → rollback on error → emit any relevant event).
4. If Rust needs to read it on startup, add a helper next to
   `stored_monitor_pref` / `stored_require_host_reachable`.

## Things to avoid

- **No WM-specific code on Linux** (`i3-msg`, sway IPC, KWin scripting,
  etc.). User rejected this explicitly. Keep cross-platform helpers like
  the hide-before-reposition pattern instead.
- **No `set_decorations(false)` on Linux / Windows.** `set_fullscreen(true)`
  hides decorations there and is well-behaved. macOS is the exception:
  Cocoa's `toggleFullScreen:` creates a Mission Control Space bound to
  whichever display Cocoa picks (often disagreeing with `set_position` on
  multi-monitor setups → kiosk reliably opens on the wrong screen).
  `window.rs::create_main_window` on macOS uses
  `decorations(false) + always_on_top(true) + explicit position + size` —
  same pattern OpenLP uses for its display window. Don't reintroduce
  `set_fullscreen(true)` on macOS without revisiting that.
- **No emojis** in code, UI text, or commit messages unless the user
  explicitly asks.
- **Don't write new files** that don't earn their place. The eight-file
  split of `Settings.tsx` was a deliberate structural decision; don't
  extract single-use components into their own files reflexively.
- **Don't reintroduce** `screen.json` / `settings.json` / `host.json` —
  everything consolidated into `config.json`.

## When the README is the better target

If your change is end-user-visible (a new setting, a behaviour change in
the kiosk window, a new tray menu item, a new platform supported),
update `README.md` too. This file is for agents picking up code-level
work; the README is for whoever ends up running the kiosk.
