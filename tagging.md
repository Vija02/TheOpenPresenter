# Tagging guide

This repo uses **one tag scheme for everything**. A single `vX.Y.Z` tag
pushed to GitHub triggers all release workflows and publishes their
assets to the same GitHub Release.

## Tag format

Use [SemVer](https://semver.org) prefixed with `v`:

| Kind | Example |
|---|---|
| Stable release | `v0.1.0`, `v1.2.3`, `v10.0.0` |
| Pre-release | `v0.1.0-rc.1`, `v0.2.0-beta.2` |

That's the only thing matched by the workflow tag filters
(`tags: ['v*']`) and by the kiosk installer's tag resolver
(`v[0-9]…` regex in `install.sh`).

**Don't tag with**:
- Plain version numbers (`0.1.0`) — won't match `v*`.
- App-prefixed names (`desktop-screen-v0.1.0`, `tv-v0.1.0`) — won't
  match either; we deliberately unified.
- `nightly` — that's a workflow-managed prerelease tag, not a tag you
  push manually.

## How to release

```sh
# 1. Make sure main is at the commit you want to ship.
git checkout main
git pull

# 2. Tag and push.
git tag v0.1.0
git push origin v0.1.0
```

The push runs `.github/workflows/release.yml`, which builds every
component in parallel and then publishes **one** `vX.Y.Z` GitHub Release
containing all of them:

| Component workflow | Builds |
|---|---|
| `desktop-screen.yml` | Kiosk app (Tauri: Linux binaries, Windows, macOS) |
| `electron-screen.yml` | Kiosk app (Electron: Linux packages) |
| `runtime.yml` | Runtime packs and manager binaries (also syncs R2 and moves `runtime-stable`) |
| `studio.yml` | Studio app (Windows, macOS, Linux) and its auto-update metadata |

Each component workflow uploads the files it wants published as a
`release-<component>` artifact. The final `publish` job only runs once
all four have succeeded: it uploads everything to a draft release, then
publishes it in a single step. Nobody (the homepage, the Studio
auto-updater, the kiosk installer) ever sees a half-uploaded release.

If any component fails, nothing is published. Fix it and re-run the
failed jobs; a draft left behind by a failed publish is replaced
automatically. The R2 runtime upload is not part of this gate: it
happens as soon as the runtime build finishes.

## Pre-releases

Pre-release tags have a suffix after the patch number:

```sh
git tag v0.2.0-beta.1
git push origin v0.2.0-beta.1
```

Any `v*` tag with a hyphen is published as a pre-release, so it stays
out of `/releases/latest` (and off the homepage download links). The
kiosk install script's loose regex still picks them up.

## Nightly tag

Pushes to `main` (without a version tag) build and refresh a moving
`nightly` GitHub Release:

- `desktop-screen.yml` publishes the kiosk binaries (tag
  `desktop-screen-nightly`).

## Homepage download links

The Studio downloads on the homepage
(`apps/homepage/src/pages/download/index.astro`) link to
`releases/latest/download/<file>`, which GitHub redirects to the release
marked **Latest**. This always points at the newest stable `vX.Y.Z`
tag because:

- Studio's installer names carry no version
  (`TheOpenPresenter-Setup.exe`, `TheOpenPresenter-arm64.dmg`; see
  `native-apps/studio/electron-builder.yml`), so the same URL works for
  every release.
- `release.yml` publishes the whole release at once and marks it Latest
  (unless the tag has a hyphen). It also refuses to publish if any of
  the files the homepage links to are missing.
- The moving `runtime-stable` release sets `make_latest: false`, so
  republishing it never takes the flag.

## Fixing a mistake

If a tag was pushed prematurely or to the wrong commit:

```sh
# Delete locally and on GitHub.
git tag -d v0.1.0
git push origin :refs/tags/v0.1.0

# Delete the GitHub Release (if it was created) via the GitHub UI or:
gh release delete v0.1.0 --yes

# Re-tag the right commit and push.
git checkout <good-sha>
git tag v0.1.0
git push origin v0.1.0
```

Don't re-use a version number that's already been downloaded by users —
prefer bumping to `v0.1.1` if anything was published.

## Where to watch

- **Workflow runs**: <https://github.com/Vija02/theopenpresenter/actions>
- **Releases**: <https://github.com/Vija02/theopenpresenter/releases>

