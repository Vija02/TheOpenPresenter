# TheOpenPresenter desktop

The desktop app. One Electron build for Windows, macOS and Linux.

## What it does

Opens TheOpenPresenter in a proper application window and adds the things a
browser tab cannot do:

- Present to a second monitor or projector, borderless and fullscreen
- Stay available from the system tray
- Optionally run the whole server on this computer, fully offline

## Modes

On first launch you choose one:

- **theopenpresenter.com** — log in to the hosted service. Nothing extra to
  download.
- **Your own server** — point the app at a server you or your church runs.
- **This computer** — download the server and work without internet.

You can change this later: **File > Settings and mode** in the menu bar, or
the tray icon. Both work at any time, including while the app is showing the
main interface.

## Signing in

Sign-in opens in your normal web browser rather than inside the app, so your
saved passwords, passkeys and existing Google or GitHub sessions all work.
Once you have signed in there, the app continues on its own.

## Offline mode

The server is not included in the app download. It arrives separately when you
ask for it, which keeps the initial download small and lets you keep working
while it downloads.

Updates only fetch what changed, so a routine update is a few megabytes rather
than several hundred.

## Where files are kept

| OS      | Location                                                  |
| ------- | --------------------------------------------------------- |
| Windows | `%APPDATA%\TheOpenPresenter`                              |
| macOS   | `~/Library/Application Support/TheOpenPresenter`          |
| Linux   | `~/.local/share/TheOpenPresenter`                         |

Inside that folder, `state/` holds your uploads, database and settings, and
`runtimes/` holds the downloaded server. Your files in `state/` are never
touched when the server updates or rolls back.

## Building from source

```sh
cd native-apps/runtime-manager && cargo build --release
cd ../desktop
mkdir -p resources && cp ../runtime-manager/target/release/top-runtime-manager resources/
npm install
npm run dist
```

## Development

```sh
npm install
npm run dev         # builds the sidecar, then starts the shell
```

`npm run dev` runs `prepare:sidecar` first, which compiles the runtime
manager and generates a development signing key. That needs Rust
(https://rustup.rs). Without it the shell still runs, but offline mode is
unavailable and the app says so rather than failing quietly.

```sh
npm run typecheck
npm test
```

## Testing offline mode

`runtime.theopenpresenter.com` does not exist yet, so the default source
fails with a DNS error. Publish a runtime from this checkout instead:

```sh
yarn build                  # from the repo root, once
yarn publish:runtime
```

That assembles the server, PostgreSQL and dependencies into a signed release
under `~/.theopenpresenter-dev-cdn`, using the local development key. Point
the app at it either in the app (offline mode screen > Change) or with:

```sh
TOP_RUNTIME_SOURCE=~/.theopenpresenter-dev-cdn npm run dev
```

Roughly 500MB installed, a minute or two to publish. Re-publishing after a
code change only writes the blobs that changed.

See `agent.md` for the internals.
