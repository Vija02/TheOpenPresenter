# @repo/shared-runtime

Builds the modules that are shared between the host apps and the dynamically
loaded plugin bundles, and generates the import map the browser uses to resolve
them.

## Why

Plugins are built as standalone ES modules and loaded at runtime with a native
`import()` (see `packages/lib/src/preloader.ts`). Anything not marked external
in a plugin build gets inlined into that plugin's bundle. With 10 plugins and 4
apps, that previously meant 14 private copies of `@repo/ui` and its
dependencies.

The cost is not only bytes. Some modules break outright when duplicated:

- **`react-hook-form`** — `@repo/ui` owns `<FormField>` / `useFormContext`,
  while plugins call `useForm()` themselves. Two copies mean two separate
  contexts, so `useFormContext()` returns `null` at runtime. This fails only in
  composed forms and looks nothing like a bundling error.
- **`@repo/lib`** — `appData` and `preloader` are module-level singletons.
  `appData.getProxyConfig()` backs the remote app's proxy params; a second copy
  silently loses them.
- **`zustand`** — `globalState/organization.ts` is a module-level store. A
  duplicate is a separate, silently diverging store.
- **`urql`** — a second client loses the shared cache and auth exchange.

## Layout

The list and the builder are separate packages:

| Package | Role |
| --- | --- |
| `@repo/shared-modules` | The list. Zero dependencies, no build step. |
| `@repo/shared-runtime` | Builds the modules and emits the import map. |

They are split because this package depends on `@repo/ui` in order to build it,
so `@repo/ui` cannot depend on this package in turn. `@repo/shared-modules`
depends on nothing, so `packages/ui`, `plugins/*` and `apps/*` can all import
the same list and derive their `external` config from it. One source of truth,
enforced by imports rather than by comments.

## Files

| File | Role |
| --- | --- |
| `build.mjs` | Driver. Spawns one Vite build per module. |
| `vite.config.ts` | Builds the single module named by the `MODULE` env var. |
| `importmap-plugin.ts` | Records each hashed filename into `importmap.json`. |
| `verify.mjs` | Fails the build on anything the browser could not resolve. |
| `watch.mjs` | Rebuilds a package's bundles when its `dist` changes. |
| `modules.mjs` | Reads the shared list from plain node (no TS loader). |

```bash
yarn workspace @repo/shared-runtime build    # build + verify
yarn workspace @repo/shared-runtime verify   # verify only
yarn workspace @repo/shared-runtime clean
```

Output goes to `backend/server/public/assets/shared/`. It is gitignored and
rebuilt from `node_modules`, so versions always track `yarn.lock`.

## How it works

`@repo/shared-modules` is the single source of truth. Each entry is built into
one hashed ESM file, and each build externalizes **every other** shared
specifier so the bundles reference one another instead of duplicating.

Builds run **one module per process**. A single Rollup pass would hoist common
code into shared chunks, but every file must stay independently resolvable from
the import map.

Because bundles reference one another by bare specifier rather than inlining
(`@repo/ui` contains `from "@repo/lib"`, resolved by the browser at runtime), a
change to `@repo/lib` cannot go stale inside `@repo/ui`. So `--only <pkg>` needs
to rebuild only that package's own entries, including subpaths such as
`@repo/video/client`, and never its dependents.

Output is content-hashed for safe cache busting under the server's `immutable`,
one-year `Cache-Control`. (The unversioned `yjs-esm.esm.js` has no such
protection.) Since every build writes a new hash and never removes the old one,
stale files must be cleared:

- a **full** build wipes the output directory up front;
- a **partial** build must not — that would delete the other modules' bundles
  and leave `importmap.json` pointing at files that no longer exist. It instead
  records the pre-existing files and deletes the unreferenced ones *after* the
  build succeeds. Deleting first would mean an interrupted run leaves a module
  with no bundle while the import map still references it.

Sourcemaps are emitted by default — shared bundles are the hardest code to debug
without them, and browsers fetch them only when devtools are open. Set
`SHARED_RUNTIME_NO_MAPS` to skip them (they are ~2x the JS on disk).

## Generated entry files

Each build compiles a small generated entry in `.generated/` (gitignored) that
re-exports the target package. These are real files rather than virtual modules
because Vite resolves `lib.entry` as a filesystem path before plugin `resolveId`
hooks run.

The entry re-exports named exports explicitly when the module declares
`namedExports` (required for CJS packages, where `export *` forwards nothing
through the interop wrapper), applies any `exportAliases`, and re-exports the
default **only when the package genuinely has one**.

### Why the default export is probed

`export *` does not forward a default, so it must be re-exported explicitly —
but getting it wrong fails in one of two ways:

- emitting `export { default }` for a package without one is a hard Rollup
  build error;
- omitting it for a package that has one builds cleanly and then throws
  `doesn't provide an export named: 'default'` in the browser.

Static analysis is not reliable enough to decide this. Every cheap heuristic
disagrees with the bundler for some package on the list:

- `require.resolve` ignores the `import` condition and returns zod's
  `index.cjs`, while the default export lives in the ESM sibling `index.js`;
- Node's `import()` synthesises a `default` for CJS that Rollup does not treat
  as a real export;
- `import.meta.resolve` ignores `mainFields`, so for urql (which has no
  `exports` field) it returns the CJS `main`, while this build resolves the
  `module` field to `urql.es.js`, which has no default.

So the question is handed to Vite itself: a probe module is built in isolation
with the **same resolve config** as the real build, and a Rollup failure means
there is no default. Slower than a regex, but correct by construction.

The shared resolve config prefers real ESM (`mainFields: ["module", "browser",
"main"]`) so Rollup can tree-shake and the output avoids interop wrappers. It
must be shared with the probe, or the probe would answer a question about a
different file — urql being exactly that case.

> The nested probe build sets `configFile: false`. Without it, the nested build
> re-reads `vite.config.ts`, which calls back into the probe and recurses until
> the process hangs.

## Watch mode

`node watch.mjs <specifier> [entryFile]`, used by the `dev` script of a shared
workspace package alongside that package's own watcher. The chain is two steps
and both are required:

```
src/ --(tsup|vite --watch)--> dist/ --(watch.mjs)--> assets/shared/*.mjs
```

The shared build reads the package's `dist`, not its source, so without this the
browser keeps loading the previous bundle even though `dist` is current.

It watches only the files the shared build actually reads — one per shared
specifier, resolved from the package's `exports` map. Watching the whole `dist`
directory was too noisy: tsup emits ~50 files across its TSC, ESM, CJS and DTS
phases and only one is an input here. Subpaths matter, since `@repo/video` and
`@repo/base-plugin` are each shared as both `.` and `./client`, resolving to
different dist files.

Rebuilds fire only when an entry's **content hash** changes, debounced by 200ms,
because tsup rewrites `index.mjs` on every phase even when the output is
identical. Directories are watched rather than files, since build tools replace
files by rename, which detaches a file-level watch.

## Import map subpaths

An import map entry does **not** cover subpaths. Mapping `zustand` does nothing
for `zustand/middleware` — that needs its own entry. `@repo/lib` imports
`persist` from that subpath, so it is listed explicitly.

## What `verify.mjs` checks

The failures it exists to catch are silent and runtime-only: a bare specifier
with no import map entry throws only when that module is first imported, which
may be deep inside a rarely used view.

1. **Every bare specifier in every bundle has an import map entry.** The regexes
   are anchored to statement start so a `from "..."` inside a string literal
   (Tailwind class metadata in `@repo/ui`) is not mistaken for a real import.
   Template-literal dynamic imports are skipped as unknowable.
2. **Every import map target exists on disk.**
3. **No server-only import** (`@trpc/server`, `@hocuspocus/server`, `node:fs`,
   `node:path`) leaked into a browser bundle.
4. **No declared named export is bound to `undefined`.** React's production
   `jsx-dev-runtime` stub exports `jsxDEV: undefined` rather than failing, so
   the bundle looks valid and checks 1–3 pass; the app then dies with
   `_jsxDEV is not a function` on the first render.
5. **The JSX runtimes work against the *vendored* React.** Being defined is not
   enough — a development JSX runtime calls `internals.getOwner()`, which the
   production vendored React does not have.

Checks 4 and 5 import each bundle **the way the browser would**: mapped
specifiers are rewritten to their import map targets and loaded as a data URL.
Letting node resolve bare `"react"` to `node_modules` would test a pairing that
never runs — which is exactly how a broken `jsx-dev-runtime` once shipped.

Check 5 is deliberately static. The dev runtime reads the owner as
`A === null ? null : A.getOwner()`, and React's owner slot is only non-null
while its own renderer is rendering; node has no renderer bound to the vendored
React, so a live call always takes the null branch and passes even when the
browser fails. What *is* checkable is the mismatch itself: if the vendored React
is a production build (detected by the absence of `getOwner`), any bundle
referencing a dev-only internal cannot work against it.

## Deliberately excluded

`isSharedModule()` in `@repo/shared-modules` refuses to externalize these, and
each rule exists because of a failure that only appears at runtime:

- **`@repo/base-plugin/server`** — pulls in express and pg. Only the root and
  `/client` entries are shared.
- **Stylesheets** (`@repo/ui/css`, `@repo/base-plugin/client/css`) — not JS
  modules and not resolvable through an import map.
- **A shared package's own internals** — `zustand` is implemented as
  `zustand/vanilla` plus `zustand/react`; externalizing those while building
  `zustand` produced a file that merely re-exported two unmapped specifiers.
  Subpaths that are themselves declared shared, such as
  `@repo/base-plugin/client`, remain external.

These rules are asserted in `packages/shared-modules/src/__tests__`.

## Relationship to the hand-vendored assets

`react`, `react-dom`, `react-dom/client` and `yjs` are still the manually
downloaded files in `backend/server/public/assets` described in
`backend/server/README.md`. They already work and are intentionally left alone.
They are re-asserted into every generated `importmap.json` so the manifest is
always a complete, self-contained import map.
