# Screen Share Plugin Guidelines

Shares the operator's screen live to every output display over WebRTC. One
sender (the remote operator) streams to N viewers (renderers). This plugin is a
good reference for any plugin that needs real-time peer-to-peer media.

## Architecture

Two runtime halves, like every plugin in this repo:

- **`src/`** — the server/node half. `init()` (`src/index.ts`) registers the
  scene, web components, and a private HTTP route (ICE servers). Runs in the
  main app process.
- **`view/`** — the browser half, split into two web components:
  - **`Remote/`** — the operator UI (sender). Captures the screen and offers it.
  - **`Renderer/`** — the output display (viewer). Answers and shows the stream.

Entry points in `view/entries/` wrap each component with `r2wc` and register the
custom elements (`screen-share-remote`, `screen-share-renderer`, defined in
`src/consts.ts`). Neither entry mounts a tRPC or react-query provider — the only
server call (ICE servers) is a plain `fetch`.

## The core design: signaling over Yjs awareness, not a socket

There is **no dedicated signaling server**. WebRTC SDP/ICE exchange rides the
existing Yjs **awareness** channel. Read `view/signaling.ts` first — its header
comment is the source of truth. Key invariants:

- Awareness is **not a message queue**. Each client publishes a single state
  object others read. So signaling is modeled as **idempotent full-state
  snapshots**: every client republishes its *entire* accumulated signaling state
  (offer/answer + full ICE candidate list) on each change. Never send deltas.
- Because snapshots are full and re-application is guarded (see
  `candidateKey` dedupe + `hasRemoteAnswer`/`hasRemoteOffer` flags), awareness's
  last-write-wins semantics are safe and late readers still converge.
- Topology is strictly **one sender → N viewers**. Sender always offers, viewer
  always answers. No glare, no perfect-negotiation rollback needed.
- The awareness field is namespaced per plugin instance via
  `signalFieldKey(pluginId)` so multiple screen-share scenes don't collide.

The reconcile effects in `useScreenShareSender.ts` and `useScreenShareViewer.ts`
run on **every awareness heartbeat** and must stay **idempotent** — they diff
current state against the peer connections and only apply what's new. When
editing them, preserve that property: no side effect should assume it runs once.

## Live objects live outside React and Yjs

`MediaStream` / `RTCPeerConnection` are never stored in Yjs or React state. They
live in **module-level maps** keyed by `pluginId` (`senderSessions`,
`viewerConnections`) so an in-progress share survives re-renders and the operator
switching scenes. Only small control state goes in Yjs (`src/types.ts`):
`isSharing`, `sharerAwarenessUserId`, `sessionId`.

Consequences to respect:

- The remote is registered with `{ alwaysRender: true }` (`src/index.ts`) so the
  sender stays mounted across scene changes and the share survives.
- `sessionId` is bumped on every new capture so viewers tear down and rebuild
  cleanly. Any change that starts a fresh stream must mint a new `sessionId`.
- Teardown must close peer connections, stop tracks, delete the module map
  entry, **and** clear the awareness field. See `stopShare` / `teardown`.

## Cleanup / ghost prevention

- **Server** (`onPluginDataLoaded`): if the client owning the active share
  disconnects, an awareness `change` handler resets `isSharing` so renderers stop
  chasing a ghost. Mirrors the audio-recorder GC pattern.
- **Client**: unmount effects call `stopShare` / `teardown`; the browser's own
  "Stop sharing" control fires the track `ended` event which also stops the share.

## ICE / TURN

`buildIceServers()` in `src/index.ts` builds the ICE list server-side and serves
it over a **private HTTP route**, `registerPrivateRoute(pluginName,
"ice-servers", …)` → mounted at `/plugin/screen-share/ice-servers`. The browser
fetches it via the `useIceServers` hook in `view/iceServers.ts` (a plain
`fetch` with a module-level session cache). This route is intentionally
**unauthenticated** — the payload is non-sensitive — and deliberately *not*
tRPC, so the renderer bundle doesn't pull in a tRPC client.

STUN-only by default; TURN is opt-in via env (`TURN_URL` + `TURN_SECRET` for
ephemeral coturn REST creds, or `TURN_URL` + `TURN_USERNAME`/`TURN_PASSWORD`
static). Never put a long-lived TURN secret in client code — credentials are
minted server-side per request.

## Conventions

- Plugin server calls that don't need auth and shouldn't drag tRPC into a view
  bundle go through `registerPrivateRoute`, mounted at
  `/plugin/<pluginName>/<path>`. `serveStatic` publishes `out/`.
- Build with `pnpm build` (`pkgroll` for `src/` + `vite build` for `view/`);
  `pnpm dev` watches both.

## Gotchas

- Don't move live media/PC objects into React state or Yjs — you'll lose them on
  re-render or serialize something unserializable.
- Don't convert signaling to deltas or assume ordered delivery — awareness is
  last-write-wins snapshot state.
- Keep the reconcile effects idempotent; they run continuously, not once.
- Keep the ICE route free of tRPC/auth — re-introducing either would re-bundle
  the tRPC client into the renderer, which this design avoids.
