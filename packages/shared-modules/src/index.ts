// Single source of truth for modules shared across the host apps and all
// dynamically loaded plugin bundles. See README.md.

export type SharedModule = {
  /** Bare specifier as written in source and as it appears in the import map. */
  specifier: string;
  /** Module id to bundle. Defaults to `specifier`. */
  entry?: string;
  /** Named exports to re-export explicitly. Required for CJS-only packages. */
  namedExports?: string[];
  /** Extra exports aliased from another name in the same target module. */
  exportAliases?: Record<string, string>;
  /** Why this module is shared. */
  reason: string;
};

/** Hand vendored entries in `backend/server/public/assets` */
export const VENDORED_MODULES: Record<string, string> = {
  react: "/assets/react@19.1.0/es2018/react.mjs",
  "react-dom": "/assets/react-dom@19.1.0/es2018/react-dom.mjs",
  "react-dom/client": "/assets/react-dom@19.1.0/es2018/client.mjs",
  yjs: "/assets/yjs-esm.esm.js",
};

/**
 * Modules built from node_modules by this package.
 *
 * Order is irrelevant; each entry externalizes every other shared specifier so
 * they reference one another rather than duplicating.
 */
export const SHARED_MODULES: SharedModule[] = [
  // --- React runtime ------------------------------------------------------
  {
    specifier: "react/jsx-runtime",
    namedExports: ["jsx", "jsxs", "Fragment"],
    reason:
      "CRITICAL: react ships this as CJS only, so a bundler that inlines it also inlines `require('react')`, producing a SECOND React. That React has its own dispatcher, so any hook called from JSX compiled against it throws 'Invalid hook call'. Built here externalizing react, so it shares the one instance from the import map.",
  },
  {
    specifier: "react/jsx-dev-runtime",
    entry: "react/jsx-runtime",
    namedExports: ["Fragment"],
    exportAliases: { jsxDEV: "jsx" },
    reason:
      "Same as react/jsx-runtime, but this is the one Vite actually uses in development. Omitting it is what made the app load a second React in dev while plugins used the import map copy.",
  },

  // --- Workspace packages -------------------------------------------------
  {
    specifier: "@repo/ui",
    reason:
      "Main UI component with important contexts.",
  },
  {
    specifier: "@repo/lib",
    reason:
      "appData and preloader are module level singletons. appData.getProxyConfig() backs the remote app's proxy params; a second copy silently loses them.",
  },
  {
    specifier: "@repo/base-plugin",
    reason: "Shared plugin types and helpers used by every plugin.",
  },
  {
    specifier: "@repo/base-plugin/client",
    entry: "@repo/base-plugin/client",
    reason:
      "The client entry is what plugin views import (47 usages). The /server entry is deliberately excluded: it pulls express and pg and must never reach the browser.",
  },
  {
    specifier: "@repo/graphql",
    reason:
      "urql documents and generated hooks shared between apps and plugins.",
  },
  {
    specifier: "@repo/layout",
    reason:
      "Layout document model and geometry, imported by the bible plugin and both host apps. Currently inlined into plugins/bible AND apps/remote, so the same code ships twice.",
  },
  {
    specifier: "@repo/layout/react",
    reason:
      "CRITICAL: owns StageContext. The bible plugin renders <LayoutRenderer> from this entry while the host app provides the stage, so a second copy makes useStage() silently return the empty metrics fallback rather than throwing. Subpaths need their own import map entry.",
  },
  {
    specifier: "@repo/layout/editor",
    reason:
      "The editor entry is used by both plugins/bible (StyleModal) and apps/remote (InteractiveLayoutEditor). Shared so the editor and the renderer agree on one layout instance. The /ai entry is deliberately excluded: it is imported only by backend/server and must not reach the browser.",
  },
  {
    specifier: "@repo/ai-chat",
    reason:
      "CRITICAL: owns the module-level transcript store (zustand). @repo/layout/editor renders the single-slide AI panel while plugins/slides renders a deck-level AI panel; a second copy would give each its own store, so a thread opened in one would be invisible to the other and the shared undo state would diverge.",
  },
  {
    specifier: "@repo/video",
    reason:
      "Shared video plugin API. Externalized together with react-player so the hls and dash chunks resolve to one copy.",
  },
  {
    specifier: "@repo/video/client",
    reason:
      "The client entry is what plugin views actually import. Subpaths need their own import map entry; the parent entry does not cover them.",
  },

  // --- Third party with context or singleton state ------------------------
  {
    specifier: "react-hook-form",
    reason:
      "CRITICAL: FormProvider context crosses the plugin boundary. @repo/ui owns <FormField>/useFormContext while plugins call useForm() directly. Two copies make useFormContext() return null at runtime.",
  },
  {
    specifier: "urql",
    reason:
      "Provider context crosses the boundary. A second client instance loses the shared cache and auth exchange.",
  },
  {
    specifier: "zustand",
    reason:
      "packages/lib/src/globalState/organization.ts is a module level store. A duplicate copy is a separate, silently diverging store.",
  },
  {
    specifier: "zustand/middleware",
    reason:
      "@repo/lib imports `persist` from this subpath. Bare subpath specifiers are NOT covered by the parent's import map entry, so without its own entry the browser would fail to resolve it at runtime.",
  },
  {
    specifier: "zod",
    reason:
      "Large (~300KB) and pulled in transitively via @repo/lib mediaUtil, so it lands in every consumer. Shared rather than removed.",
  },
  {
    specifier: "react-player",
    reason:
      "The real source of the 1.26MB dash and 750KB hls chunks, which were byte identical duplicates across lyrics-presenter and video-player. Must be shared for @repo/video sharing to actually dedupe them.",
  },
];

/** Every specifier the browser can resolve from the import map. */
export const ALL_SHARED_SPECIFIERS: string[] = [
  ...Object.keys(VENDORED_MODULES),
  ...SHARED_MODULES.map((m) => m.specifier),
];

/** Matches subpaths of a shared package, e.g. `zod/v4/core`. */
const DEEP_INTERNAL_RE = new RegExp(
  `^(${SHARED_MODULES.map((m) => m.specifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})/(?!$)`,
);

/**
 * True when `id` resolves to a shared module. `self` is the specifier of the
 * package currently being built, which must never externalize itself.
 *
 * See README.md for the exclusion rules.
 */
/**
 * Server-only entries of otherwise shared packages.
 *
 * These pull in server dependencies (express, pg, AI SDKs) and must stay
 * bundled server side rather than being resolved from the browser's import map.
 */
const SERVER_ONLY_ENTRIES = ["@repo/base-plugin/server", "@repo/layout/ai"];

export const isSharedModule = (id: string, self?: string): boolean => {
  if (SERVER_ONLY_ENTRIES.includes(id)) return false;

  if (id.endsWith("/css") || id.endsWith(".css")) return false;

  if (ALL_SHARED_SPECIFIERS.includes(id)) {
    return self === undefined || id !== self;
  }

  if (DEEP_INTERNAL_RE.test(id)) return false;

  return false;
};

/** `rollupOptions.external` predicate for plugin and host app builds. */
export const sharedExternals = (id: string): boolean => isSharedModule(id);
