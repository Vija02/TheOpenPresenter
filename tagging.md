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

The push fires two workflows in parallel:

| Workflow | Builds | Publishes to release as |
|---|---|---|
| `.github/workflows/tauri.yml` | Main desktop app (Windows MSI/NSIS, macOS dmg) | `TheOpenPresenter_<ver>_x64-setup.exe`, `…_x64_en-US.msi`, `…_aarch64.dmg` |
| `.github/workflows/desktop-screen.yml` | Kiosk binaries (Linux x86_64 + aarch64) | `desktop-screen-linux-x86_64`, `desktop-screen-linux-aarch64` |

Both target the same `vX.Y.Z` GitHub Release. The `softprops/action-gh-release@v2`
action is idempotent — the first workflow to finish creates the release,
the second updates it with its own assets. Whichever finishes last sets
the release notes / name.

## Pre-releases

Pre-release tags (anything with a suffix after the patch number) need
one extra signal so GitHub marks them as such:

```sh
git tag v0.2.0-beta.1
git push origin v0.2.0-beta.1
```

By default `softprops/action-gh-release@v2` doesn't infer prerelease
from the tag name; the published release will appear as a normal one. If
that matters to you (e.g., to keep them out of `/releases/latest`):

- Set `prerelease: true` in the release step, or
- Use the GitHub UI to mark it as pre-release after the fact, or
- Adopt the convention "tags with a hyphen are pre-releases" and let
  the install script's loose regex pick them up anyway.

## Nightly tag

Pushes to `main` (without a version tag) build and refresh a moving
`nightly` GitHub Release:

- `tauri.yml` publishes the main app artifacts.
- `desktop-screen.yml` publishes the kiosk binaries (tag
  `desktop-screen-nightly` - separate from `nightly` to avoid the
  cross-publish issue at the nightly level).

The homepage's Windows download link
(`apps/homepage/src/pages/download/index.astro`) hard-codes the
`nightly` tag, so it always points at the most recent main build.

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

