# @repo/shared-modules

The single source of truth for modules shared between the host apps and all
dynamically loaded plugin bundles.

Each entry is built once into `backend/server/public/assets/shared/` and exposed
to the browser through a generated import map. Plugin and app builds mark these
specifiers as external, so the browser resolves them to the one shared copy
instead of inlining a private duplicate.

This package intentionally has **no dependencies and no build step**. It is a
plain list consumed by:

| Consumer | Use |
| --- | --- |
| `@repo/shared-runtime` | Builds the modules and emits the import map. |
| `packages/ui` | Externalizes them from its own bundle. |
| `plugins/*` | Externalize them from their bundles. |
| `apps/*` | Externalize them, in dev too. |

The list lives here rather than in `@repo/shared-runtime` to avoid a dependency
cycle: the runtime package depends on `@repo/ui` in order to build it, so
`@repo/ui` cannot depend on the runtime package in turn.

## What belongs on the list

A module belongs here when it is used on **both** sides of the plugin boundary
**and** carries React context or module-level state. Two copies of such a module
do not merely waste bytes — they break at runtime: a provider rendered by one
copy is invisible to a consumer from the other.

Every entry carries a `reason` field, because most of these failures are
runtime-only and are not obvious from the dependency graph.

## Entry shape

- `specifier` — the bare specifier as written in source and as it appears in the
  import map.
- `entry` — module id to bundle, defaults to `specifier`.
- `namedExports` — named exports to re-export explicitly. Needed for CJS-only
  packages: `export *` does not forward the named properties of a CJS module
  through the bundler's interop wrapper, so the shared bundle would expose only
  a default. `react/jsx-runtime` is exactly this case, and JSX-compiled code
  imports `jsx`, `jsxs` and `Fragment` by name.
- `exportAliases` — extra exports aliased from another name in the same target
  module, as `exportedName: sourceName`. See below.
- `reason` — why the module is shared.

## The JSX runtime

`react` ships `jsx-runtime` as CJS only, so a bundler that inlines it also
inlines `require("react")`, producing a **second React**. That React has its own
dispatcher, so any hook called from JSX compiled against it throws
`Invalid hook call`. Both `react/jsx-runtime` and `react/jsx-dev-runtime` are
therefore shared — omitting the dev entry is what made the app load a second
React in development while plugins used the import map copy.

`react/jsx-dev-runtime` is built from the **production** `jsx-runtime` with
`jsxDEV` aliased to `jsx`. The vendored `react.mjs` is a production build: its
internals are `{H, A, T, S, V}` with no `getOwner`. The real development JSX
runtime calls `internals.getOwner()` to record `_owner` for component stacks, so
pairing it with production React throws `e.getOwner is not a function`.
Meanwhile React's production `jsx-dev-runtime` stub exports `jsxDEV: undefined`,
which throws `_jsxDEV is not a function`. The alias sidesteps both; the extra
dev-only arguments (`source`, `self`) are ignored, costing only the dev-time
component stacks that production React cannot produce anyway.

## Resolution rules (`isSharedModule`)

`isSharedModule(id, self?)` decides whether an id resolves to a shared module.
`self` exists because a package that is itself shared must never treat its own
specifier as external while building — `@repo/ui` externalizing `@repo/ui` would
emit a bundle that imports itself.

Never shared:

- **`@repo/base-plugin/server`** — pulls in express and pg and must stay bundled
  server side, even though the parent `@repo/base-plugin` specifier is shared.
- **Stylesheets** (`@repo/ui/css`, `@repo/base-plugin/client/css`, `*.css`) —
  not JS modules and have no import map entry. Externalizing them would leave an
  unresolved import in the bundle; CSS is delivered separately.
- **Deep internals of a shared package** (`zod/v4/core`, reached via
  `@hookform/resolvers/zod`) — already contained in that package's shared
  bundle, so mapping them separately would create a second, diverging instance.
  This also covers a shared package's own internals while it is being built:
  `zustand` is implemented as `zustand/vanilla` plus `zustand/react`, and
  externalizing those emitted an empty shell that 404s at runtime.

Exactly declared specifiers always win, including subpaths with their own entry
such as `@repo/video/client`. **An import map entry does not cover subpaths** —
mapping `zustand` does nothing for `zustand/middleware`, which is why the latter
is listed explicitly.

`sharedExternals(id)` is the `rollupOptions.external` predicate for plugin and
host app builds.

These rules are asserted in `src/__tests__/isSharedModule.test.ts`.

## Vite dependency pre-bundling (`./optimizer`)

`externalizeSharedInOptimizer()` is an esbuild plugin that keeps shared modules
out of Vite's dependency pre-bundling.

Vite pre-bundles CommonJS dependencies in development. A CJS package such as
`wouter` or `@uppy/react` contains `require("react")`, and esbuild resolves that
to the real React and inlines a full copy into the optimized chunk. The app then
runs two Reacts — the shared one from the import map and the one buried inside
the optimized dependency — and hooks from the second copy fail with
`Invalid hook call ... dispatcher is null`, because only the first copy's
dispatcher is ever set.

`vite-plugin-externalize-dependencies` does not prevent this: it only marks
`kind === "import-statement"` as external, so `require()` calls inside CJS
dependencies fall through and pull React in.

Import statements and require calls therefore need different treatment:

- **Import statements** are marked external and survive as bare specifiers,
  which the browser resolves through the import map.
- **Require calls** cannot be external — esbuild has no way to express a
  synchronous CJS require of an external module in ESM output, so it emits a
  `__require` stub that throws `Dynamic require of "react" is not supported`.
  They are instead pointed at a generated ESM proxy module that imports the bare
  specifier, which esbuild converts to a namespace object for the CJS caller.
  That keeps `React.useState` working inside packages like wouter's nested
  `use-sync-external-store` shim.

The proxy forwards the default export explicitly (`export *` omits it) and falls
back to the namespace for packages without one, matching what a CJS caller
expects from `require()`.

## Related

`react`, `react-dom`, `react-dom/client` and `yjs` are hand-vendored files in
`backend/server/public/assets`, listed here as `VENDORED_MODULES`. See
`packages/shared-runtime/README.md` and `backend/server/README.md`.
