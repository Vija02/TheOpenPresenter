# top-studio-helper

Native pieces of TheOpenPresenter Studio that Electron and Node can't do by
themselves. Ships next to `top-runtime-manager` as a sidecar, but has nothing
to do with installing or running the server runtime.

- **Remote access over iroh.** A dumbpipe-compatible tunnel (ALPN
  `DUMBPIPEV0`) to the local server, so the cloud, or the `dumbpipe` CLI, can
  reach it without port forwarding. The identity lives at
  `<root>/data/iroh_secret_key`, so the endpoint ID survives restarts.
- **Joining another install.** The other half: dial a host by ticket or bare
  endpoint ID and serve its app on a local port. One QUIC connection carries
  a stream per TCP connection, and a dropped connection is dialed again on
  the next request. Needs no runtime on the joining machine.
- **Finding hosts on the network.** mDNS (`_theopenpresenter._udp`),
  advertised only while hosting. Each peer found is asked for its name and
  server port over a small info protocol (ALPN `top/info/0`) and listed only
  if it answers. Joining without a port uses the host's port.
- **`grab-input`.** `EVIOCGRAB` on an evdev device passed as fd 3 (Linux), so
  clicker presses go only to the app.

## Two ways to run it

**As a sidecar.** With stdin on a pipe it speaks newline-delimited JSON, the
same shape as the runtime manager. Studio starts it on first use.

```
> {"id":1,"cmd":"remote_start"}
< {"id":1,"ok":true,"result":{"enabled":true,"node_id":"…","ticket":"endpoint…"}}
> {"id":2,"cmd":"remote_status"}
> {"id":3,"cmd":"remote_connect","peer":"<ticket or endpoint id>","port":3000}
< {"id":3,"ok":true,"result":{"peer":"…","local_url":"http://localhost:3000","connected":true}}
> {"id":4,"cmd":"remote_disconnect"}
> {"id":5,"cmd":"discover_start"}
< {"id":5,"ok":true,"result":{"hosts":[]}}
< {"event":"host_discovered","host":{"id":"…","name":"Main hall","port":6678}}
< {"event":"host_expired","id":"…"}
> {"cmd":"shutdown"}
```

Closing stdin stops the tunnel and exits.

**As a CLI.**

```sh
top-runtime-manager start        # in one terminal
top-studio-helper remote start          # in another; prints a ticket, Ctrl-C stops

top-studio-helper remote discover                 # on the joining machine: lists hosts
top-studio-helper remote connect <ticket or id>   # then join one
```

`--root` must match the runtime manager's (both default to the same place).
With `start`, `--port` forwards to a fixed port instead of the runtime's. With
`connect`, it's the local port to serve on if it's free.

Both roles share one iroh endpoint and identity. Incoming connections are
refused unless hosting is on.

## How it finds the server

It reads the server's port from the runtime manager's lock file
(`<root>/runtime.lock`) on every incoming connection. A runtime that crashes
and comes back on another port keeps working through the same tunnel and
ticket. The helper also records its ticket in that lock, so a second app
sharing the runtime shows the same ticket instead of opening another tunnel.

## Development

```sh
cargo test --all-targets
cargo run --example tunnel_probe -- <ticket>   # HTTP GET through a tunnel
```

Licensed under AGPL-3.0, like the rest of the repository.
