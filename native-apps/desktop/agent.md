# agent.md — desktop shell

Orientation for AI coding agents working in `native-apps/desktop/`.

## What this is

The Electron shell that replaces the Tauri Studio app and the two per-platform
screen shells. Electron on every OS, because the macOS WKWebView breaks media
playback badly enough that the Tauri macOS bundle never worked in practice.

It is deliberately thin. It opens a window, decides which server to point at,
and provides the things a browser tab cannot: presenting to a chosen monitor,
a tray icon, and an optional local server.

## Where things live

### Main process — `src/main/`

- `index.ts` — app lifecycle, GPU/throttling switches, single-instance lock,
  `startupRoute()` (what the user sees on launch) and `forwardRuntimeEvents()`.
  The `before-quit` handler holds the quit until the runtime has stopped,
  because PostgreSQL keeps its port otherwise and the next launch fails.
- `auth.ts` — browser-handoff sign-in over the server's `/qr-auth` flow.
- `menu.ts` — the application menu. Load-bearing: see the pitfall below.
- `runtime.ts` — client for the `top-runtime-manager` sidecar. Owns the NDJSON
  framing, request/response correlation by `id`, and event fan-out.
- `settings.ts` — the settings file and `normalizeHost`, which decides http vs
  https for typed hosts.
- `windows.ts` — main window plus presentation windows keyed by renderer id.
- `host.ts` — reachability probing and session cookie checks.
- `ipc.ts` — the whole IPC surface, shared by the shell UI and the web app.
- `tray.ts` — tray icon and menu.

### Preload — `src/preload/index.ts`

Exposes `window.theOpenPresenterDesktop`. This is the contract the web app
sees; `@repo/desktop-bridge` is written against it. Changing a channel name
here means changing it there too.

### Renderer — `src/renderer/`

The shell's own UI only: mode picker, server setup, local runtime management.
It disappears the moment the window navigates to the server.

## Modes

`cloud`, `selfhosted`, `local` — a stored setting, not separate builds.
Switching to local is a download, not a reinstall.

## Build and verify

```sh
npm run typecheck   # both tsconfigs; fast
npm test            # includes driving the real manager binary
npm run build       # electron-vite
npm run dist        # electron-builder, needs the sidecar staged
```

`npm test` requires a built manager: run `cargo build` in
`../runtime-manager` first. The integration suite fails loudly rather than
skipping if it is missing, because a silently skipped integration test is
worse than none.

## Pitfalls

**The window navigating away is a one-way door without the menu.** Once the
shell UI is replaced by the server page, the only routes back to the mode
picker are the application menu (File > Settings and mode) and the tray. If
you add a state the app can navigate into, check there is still a way out of
it from `menu.ts`.

**Sign-in goes to the user's browser, not this window.** `auth.ts` opens the
server's `/qr-auth` handoff and sends the user to their real browser, where
their password manager, passkeys and existing Google/GitHub sessions live. Do
not "simplify" this into an in-window login form. The fallback for servers
without Redis (which cannot run the handoff) is `BrowserLoginUnavailable`,
and the UI then navigates in-window instead of dead-ending.

**Do not treat an abort as a cancel in `auth.ts`.** The stream is aborted
deliberately just before the token exchange, so a naive catch around both
swallows a genuine exchange failure and the promise never settles. The
exchange has its own try/catch for that reason, and a test pins it.

**The sidecar must be staged before packaging, and before `npm run dev`.**
`npm run dev`, `test` and `pack` all run `scripts/prepare-sidecar.cjs` first,
which builds the manager into `resources/` — the same place the packaged app
reads it from, so both resolve it identically. `npm run dist` does not,
because CI cross-compiles per platform and stages it itself.

**The manager's signing key is baked in at compile time.** `build.rs` reads
`TOP_RUNTIME_PUBKEY` (CI) or `dev-pubkey.txt` (local). A binary that reads
its trust anchor from the runtime environment is not trusted, it is
bypassable, so do not "simplify" this back into a runtime lookup. The CI
smoke test deliberately runs the shipped binary with no environment at all
to prove the key is really in there.

**Offline mode is not gated on being in local mode.** The manager is started
at boot in every mode. It is idle until asked and downloads nothing, and
starting it eagerly is what lets the offline screen report real state.
Gating it meant a user who picked cloud saw "the runtime manager is not
running", which reads as a fault but only meant "you have not chosen local".

**A runtime that installs is not a runtime that boots.** Most of what
`scripts/publish-local-runtime.cjs` does is compensating for things static
analysis cannot see, each of which was found by the server dying at startup:
whole package directories rather than `dist/` (postgraphile.tags.jsonc,
install-db-schema.js), native `.node` packages nft cannot trace because the
filename is built from `process.platform`, `dotenv` hoisted to the runtime
root, the `@repo/*` workspace resolvers, and only the plugins in
`ENABLED_PLUGINS`. The script asserts the critical ones exist before
publishing; add to that list rather than discovering the next one at
runtime.

**Symlinks are first-class in the manifest.** Shared libraries resolve
through soname chains (`libicuuc.so.60` -> `libicuuc.so.60.2`). Flattening
them into copies loses the name the dynamic linker asks for and PostgreSQL
fails with exit 127, which reads as a missing binary. Relative links are
published as links; absolute ones are published as content, because they
point at the build machine.

**Do not reintroduce `window.__TAURI_INTERNALS__` checks in the web apps.**
They go through `@repo/desktop-bridge` so the same code runs in Electron,
Tauri and a plain browser. A direct `@tauri-apps/api` import at module scope
also forces Tauri into bundles that will never run inside it.

**macOS presentation uses `setSimpleFullScreen`.** Native fullscreen moves the
window to its own Space, which hides the operator's main window behind a Space
switch every time they present.

**Escape is registered on focus, not globally.** A global Escape fires while
the operator is typing in the main window.

## Related

- `docs/DESKTOP-ARCHITECTURE.md` — why this shape
- `native-apps/runtime-manager/README.md` — the protocol
- `packages/desktop-bridge/` — what the web app uses
