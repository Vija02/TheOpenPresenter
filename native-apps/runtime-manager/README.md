# Runtime manager

Downloads, verifies, activates and runs the TheOpenPresenter server runtime.

A single self-contained Rust binary with no Node dependency, because the
thing it installs *is* Node. It ships as a sidecar inside the desktop app
and is also usable directly from a terminal for inspection and recovery.

Runs on Linux, macOS and Windows from one codebase. The platform-specific
parts are deliberately small and all in two places: `storage/link.rs`
(reflink, hardlink and copy fallbacks) and `storage/paths.rs` (where the
data directory lives).

## Two ways to run it

**As a sidecar.** With stdin connected to a pipe it speaks newline-delimited
JSON, one request per line, responses and events on stdout. This is what the
Electron shell drives. Logging goes to stderr so it can never corrupt the
stream.

```
> {"id":1,"cmd":"ensure","channel":"stable"}
< {"event":"progress","phase":"download","done":412,"total":15298}
< {"event":"ready","version":"1.9.0","root":"…","entry":"run_server.mjs"}
> {"id":2,"cmd":"start"}
< {"id":2,"ok":true,"result":{"url":"http://localhost:53411"}}
```

**As a CLI.** With stdin on a terminal it behaves like a normal command.
The binary is the whole product for a headless install: no Electron, no
Tauri, no Node on the host, because the runtime it downloads brings its
own.

```sh
top-runtime-manager start
```

Downloads a runtime if none is installed, starts PostgreSQL, the server
and the worker, prints the URL, and shuts everything down cleanly on
Ctrl-C. This is the same code path the desktop app drives over the
protocol, so there is one implementation rather than a headless variant
that rots.

```sh
top-runtime-manager status           # what is installed and active
top-runtime-manager check stable     # newest version on a channel
top-runtime-manager install          # download, without switching
top-runtime-manager install 1.9.0    # pin a specific version
top-runtime-manager activate 1.9.0   # switch; takes effect on next start
top-runtime-manager remove           # delete the version in use
top-runtime-manager remove 1.8.3     # delete a specific one
top-runtime-manager prune            # reclaim disk
top-runtime-manager paths            # where everything lives
```

Add `--json` to any of them for machine-readable output. `--root` and
`--source` override the install location and the release server.

Downloading and switching are separate on purpose, and `install --activate`
combines them when nothing is running. An update that switched the runtime
the moment it finished downloading would do so during whatever the user is
in the middle of; the desktop shell therefore activates only when the server
is stopped, and otherwise reports that a version is waiting for a restart.

`remove` deletes the version in use if you ask it to, stopping the server
first and falling back to another installed version (preferring the last
known-good one). Refusing would only send people to `rm -rf`, which leaves
the active pointer aimed at a directory that no longer exists. It prompts
before removing the active version unless given `--force`, and never
touches `data/`, so your presentations and database survive. Removing frees
the tree; `prune` then reclaims the shared blobs.

Activating an installed version never touches the network. Its verified
manifest is stored inside the version directory at install time, so the
whole offline path works with no connectivity, which is the entire reason
to install a runtime in the first place.

The split is automatic: a piped stdin means a shell is driving, a terminal
means a person is. `serve` forces the protocol mode explicitly.

## Where things are stored

Under the platform data directory (`~/.local/share/TheOpenPresenter`,
`~/Library/Application Support/TheOpenPresenter`, `%APPDATA%\TheOpenPresenter`),
overridable with `--root` or `TOP_RUNTIME_ROOT`. Run `paths` to see it.

```
versions/1.9.0/     installed runtimes, read-only after assembly
data/               IRREPLACEABLE. Back this up.
  db/               PostgreSQL cluster
  uploads/          imported media
cache/              safe to delete; costs a re-download
  blobs/ab/ab12…    content-addressed file store
  staging/          partially assembled runtimes
logs/
config.json         active version, rollback bookkeeping
```

The segmentation is by **what losing it costs you**, not by what the code
calls it. On a full disk, delete `cache/`. Deleting `data/` loses the user's
presentations.

This is also why activation and rollback are safe: they only ever touch
`versions/` and `config.json`, never `data/`. A test enforces that user data
can never end up inside the cache, and another enforces the converse, so
"delete cache/ to free space" stays true advice.

An install made by an earlier layout is migrated automatically on first run.
The migration only renames whole directories into names that do not yet
exist, never merges and never deletes, so running it twice cannot clobber
live data.

## How updates work

Each release is a directory of files plus a signed manifest listing every
file with its sha256. Updating is:

1. Fetch the channel pointer, e.g. `channels/stable.json`, to resolve a
   version.
2. Fetch and verify that version's manifest against the compiled-in
   ed25519 key. One signature covers the manifest; per-file integrity
   follows from the hashes inside it.
3. Diff the manifest against the local content store and fetch only blobs
   not already held. Unchanged files, which is most of a release, cost
   nothing.
4. Assemble a new directory under `versions/`, linking every unchanged file
   from the store (reflink, else hardlink, else copy).
5. Flip `config.json`.

A runtime directory is never modified in place, so an interrupted update
leaves the running version untouched. The previous version stays installed,
and rollback is a pointer flip.

Before any of that, the manager checks free space and refuses an install
that would not fit, counting only what it actually has to write: an update
that reuses most of its blobs needs room for the delta, not the whole
release. It reserves 512MB of headroom, because a filesystem at zero bytes
does not merely fail writes, it can corrupt the running PostgreSQL. An
install that fits but leaves under 2GB emits a warning rather than failing.

Two things bound rollback:

- **Migrations.** The manager records which schema version last migrated the
  database and refuses to activate a runtime that cannot read it. Rolling
  back past a migration is a data-loss hazard, so it is refused rather than
  attempted.
- **Crashes.** Repeated startup crashes revert to the last known-good
  version automatically.

Because releases share a content store, keeping the previous version costs
only the delta rather than a second full copy.

### Signing

Releases are signed with `top-runtime-publish`; the public key is baked into
the binary at compile time by `build.rs` from `TOP_RUNTIME_PUBKEY` in CI.

A binary that reads its trust anchor from the runtime environment is not
trusted, it is bypassable, so this is deliberately not a runtime lookup. The
`TOP_RUNTIME_PUBKEY` environment variable still overrides it for testing
against a locally published runtime; CI's smoke test runs the shipped binary
with no environment at all to prove the real key is embedded.

## Channels

Two, published by the same workflow from different triggers:

| Channel | Built from | Version looks like |
|---|---|---|
| `stable` | a `v*` git tag | `1.9.0` |
| `nightly` | every push to `main` | `0.0.0-nightly.20260922.a1b2c3d` |

Stable is the default; nothing has to opt in. Nightly carries the date for
humans and the short sha so a bug report maps to a commit.

Each channel has its own pointer under `channels/<platform>/`, so a
nightly can never replace what stable users download. Each also builds
deltas against its own history: a nightly diffed against the last stable
would cover weeks of change and be larger than the full pack.

```sh
top-runtime-manager install nightly --activate
top-runtime-manager install stable --activate   # and back again
```

Switching back costs no download when the blobs are already held: the two
versions share everything except what actually differs.

Version strings are never parsed, ordering comes from the published index
and delta chaining is a graph walk over the packs that exist, so the
nightly format is free to be readable rather than semver-compatible.

### What a long gap costs

Storage grows by one full pack (~141MB per platform) per release, so a
nightly channel would reach ~42GB after a year if nothing were ever
removed. Blobs do not have that problem: they are content-addressed, so a
file unchanged between releases keeps its key and is stored once.

Blobs are never trimmed. They are shared, they only grow by what actually
changed, and they are what makes switching between versions nearly free.

So a client N nightlies behind resolves in this order:

1. A single delta, if one covers the hop
2. A chain of deltas, up to 12 hops
3. The current full pack
4. Individual blobs for anything the packs did not cover

Someone 100 nightlies behind falls through to the full pack and downloads
~141MB once, the same as a fresh install. Someone a few behind gets the
delta chain and downloads almost nothing. Because blobs are hosted too, a
download interrupted partway resumes from whatever the CAS already holds
rather than starting the pack again.

## Where releases come from

Releases are published to Cloudflare R2 by `.github/workflows/runtime.yml`
and downloaded from `https://runtime.theopenpresenter.com` by default. See
`docs/RUNTIME-SIGNING-AND-RELEASES.md` for signing, keys and hosting.

A release is per-platform: the runtime contains PostgreSQL, ffmpeg and a
dozen native addons, none of which are portable. Every CDN key carries the
platform except `blobs/`, which is content-addressed and therefore shared,
so JavaScript identical across platforms is stored once.

```text
channels/<platform>/<channel>.json
versions/<platform>.json
runtimes/<platform>/<version>/manifest.json
blobs/<aa>/<sha256>                      shared
packs/<platform>/full__<version>.tar.zst
packs/<platform>/<from>__<to>.tar.zst
```

`--source` accepts `github:owner/repo@tag`, an `https://` base URL, or a
local directory. R2 is the default and hosts the full tree; the GitHub
mirror carries packs and metadata only.

## Source layout

```
src/storage/   bytes on disk: layout, blob store, cheap copies
src/runtime/   acquiring a version and running it
src/shell/     how callers drive this binary (CLI + JSON protocol)
src/publish/   building a release; used only by top-runtime-publish
```

`storage` knows nothing about versions or servers, `runtime` builds on it,
and `publish` is the only group the manager binary never touches.

## Development

```sh
cargo test                  # 115 tests
cargo clippy --all-targets
```

`tests/protocol_e2e.rs` drives the real compiled binary over the protocol
exactly as Electron does, and `tests/publish_roundtrip.rs` publishes with the
real publisher and installs with the real manager. Neither uses mocks: the
bugs worth catching here are the ones that only appear when the pieces meet.

To publish a runtime from a checkout for local testing, see
`native-apps/desktop/scripts/publish-local-runtime.cjs`.
