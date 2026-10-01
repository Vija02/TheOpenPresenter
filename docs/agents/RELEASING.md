# Releasing Studio and the Runtime

Two delivery paths. Ask which process the changed code runs in:

- **Electron shell or runtime manager** → Studio release. The manager ships
  bundled inside Studio, so a runtime publish does **not** deliver a manager
  fix. This has caught us more than once.
- **The node server the manager launches** (server, plugins, `packages/**`,
  `backend/**`) → runtime publish.

## Studio

Bump `version` in `native-apps/studio/package.json`, then tag `v1.2.3`.
electron-updater compares that version, so an unbumped version means existing
installs never see the update even though the artifacts uploaded fine.

## Runtime

Version is derived, nothing to edit: tag `v*` → stable, push to `main` →
nightly. The channels are separate and a fresh install defaults to `stable`, so
check what is actually live before concluding a fix failed:

```
curl https://runtime.theopenpresenter.com/channels/<platform>/<channel>.json
```
