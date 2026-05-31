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
- `platform.rs` — Linux env fixups (GStreamer / WebKit) for packaged
  builds.
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
- **No `set_decorations(false)`** to fake kiosk. `set_fullscreen(true)`
  hides decorations on all three platforms.
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
