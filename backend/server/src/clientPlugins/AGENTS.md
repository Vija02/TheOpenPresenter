# Client Plugins (CPlugins)

Frontend-only plugins authored as React/TSX, stored in the DB, and built server-side.
Unlike native plugins (`plugins/*`), they have no server router and ship no code to the repo.

Runtime name: `cplugin-<clientPluginId>-<versionId>`, tags `-remote` / `-renderer`.

## 1. Build (esbuild)

`build.ts` bundles the author's `remote.tsx` / `renderer.tsx` with **esbuild** (not eslint).
`entry.ts` injects the r2wc + `PluginAPIProvider` wrappers — authors never write those.

- Shared modules (`react`, `@repo/layout`, `@repo/ui`, ...) stay **external**, resolved from the
  import map, so plugins share the host's single React instance.
- Also allowed: static `https://esm.sh/...` imports, and bundled `@r2wc/*`.
- Rejected: arbitrary npm, `/server` entries, dynamic `import()`, `eval`, `localStorage`, cookies.
- CSS is namespaced to the plugin's container so it can't restyle the host.

### Test build vs publish

Two mutations, deliberately asymmetric:

- `testBuildClientPlugin` (`api/clientPlugin/testBuildClientPlugin.ts`) compiles editor source
  and returns the log. **Writes nothing** — no version row, no artifacts. Authors iterate on a
  broken build without burning version numbers.
- `buildClientPluginVersion` builds an existing version row and persists (below).

The editor only calls the second one after the first succeeds, and it pins the exact source that
passed; editing afterwards invalidates it and re-locks Publish.

## 2. Upload to storage

`persist.ts` writes every output to object storage via `artifactStore.ts` under
`cplugin/<versionId>/<filename>`, **then** flips `build_status` to `built` and records the
filename/contentType list in `client_plugin_versions.artifacts`. Storage-first ordering means a
version never looks built without its bytes. Success also promotes `client_plugins.latest_version_id`.

Versions are immutable (no update/delete grants). The mutable working copy is the
org-shared row in `client_plugin_drafts`, autosaved from the editor.

## 3. Serve (proxyable, like media)

`middleware/installClientPluginStatic.ts` owns `/cplugin/<versionId>/<filename>`. Two mutually
exclusive branches, mirroring `/media/data` in `installFileUpload.ts`:

- `STORAGE_TYPE=s3` + URL `STORAGE_PROXY` -> proxy to the bucket/CDN.
- Otherwise -> RLS + artifact-manifest check, then stream from the store.

In prod we disable `STORAGE_PROXY` and point a Cloudflare rule at `/cplugin`, so neither branch
runs. Consequence: with the proxy/CDN path, artifacts are public to anyone holding the
`versionId` — the `select_public` / `select_installed` RLS policies only gate the streaming branch.

## 4. Auto-exposed as a scene creator

`resolveForOrg.ts` resolves each org's enabled + built versions into tags and artifact
URLs; `api/pluginMeta.ts` exposes them as `clientPluginViews`. A null `pinned_version_id`
means "follow the latest built version" and is resolved with a `join lateral … limit 1`,
so publishing ships to the org without touching the install row. A non-null pin still
locks to that exact version. From there it's automatic:

- `PluginMetaDataProvider` calls `preloader.registerRuntimePlugin` **synchronously during render**.
  It must not move into `useEffect`: effects run child-first, so `PluginRenderer` would call
  `getPluginPromise` before registration — and an unknown name resolves `Promise.all([])`
  instantly, rendering the custom element before `customElements.define` runs.
- `NewScene.tsx` concatenates `clientPluginViews` onto the native `sceneCreator` list.

## 5. Seeding on creation

Native plugins seed via a server `onPluginDataCreated` hook. CPlugins have no server lifecycle,
so seeding is client-initiated from the manifest:

- `NewScene.tsx` writes `manifest.pluginData` into the new scene's `pluginData`.
- **Renderer data rides along inside `pluginData`** as `__initialRendererData`, because that's the
  only object the client can seed at creation time.
- `YjsState.ts` (`seedClientPluginRendererData`) detects the `cplugin-` prefix, unpacks that key,
  and copies it into the real `rendererData`.
