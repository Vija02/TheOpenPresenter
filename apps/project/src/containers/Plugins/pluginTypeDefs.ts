import { SHARED_MODULES } from "@repo/shared-modules";

// The glob pattern must be statically analysable by Vite, so it can't be built
// from SHARED_MODULES at runtime. It's pinned to the shared package dirs to
// keep unrelated packages (embedded-postgres, test, observability) out of the
// build, and SHARED_PKG_DIRS is asserted against it below so the two can't
// silently diverge.
const SHARED_GLOB_DIRS = [
  "ai-chat",
  "base-plugin",
  "graphql",
  "layout",
  "lib",
  "ui",
  "video",
] as const;

const DTS_MODULES = import.meta.glob(
  "../../../../../packages/{ai-chat,base-plugin,graphql,layout,lib,ui,video}/dist/**/*.d.ts",
  { query: "?raw", import: "default" },
) as Record<string, () => Promise<string>>;

/** Workspace dir names of every shared @repo package, e.g. "layout". */
const SHARED_PKG_DIRS = new Set(
  SHARED_MODULES.map((m) => m.specifier)
    .filter((s) => s.startsWith("@repo/"))
    .map((s) => s.split("/")[1]!),
);

/** Subpath specifiers needing their own synthetic package.json */
const SHARED_SUBPATHS = SHARED_MODULES.map((m) => m.specifier).filter(
  (s) => s.startsWith("@repo/") && s.split("/").length === 3,
);

// Fail loudly in dev if not synced
if (import.meta.env.DEV) {
  const missing = [...SHARED_PKG_DIRS].filter(
    (d) => !SHARED_GLOB_DIRS.includes(d as (typeof SHARED_GLOB_DIRS)[number]),
  );
  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      `[pluginTypeDefs] SHARED_MODULES has @repo packages missing from the ` +
        `glob in this file, so the plugin editor has no types for them: ` +
        `${missing.join(", ")}. Add them to the import.meta.glob pattern.`,
    );
  }
}

const REACT_DTS_MODULES = import.meta.glob(
  "../../../../../node_modules/@types/react/{index,jsx-runtime,global}.d.ts",
  { query: "?raw", import: "default" },
) as Record<string, () => Promise<string>>;

const toMonacoPath = (repoPath: string): string | null => {
  const m = repoPath.match(/packages\/([^/]+)\/dist\/(.+)$/);
  if (!m) return null;
  const [, pkg, rest] = m;
  if (!SHARED_PKG_DIRS.has(pkg!)) return null;
  return `file:///node_modules/@repo/${pkg}/dist/${rest}`;
};

const packageEntries = (): { dir: string; types: string }[] => [
  ...[...SHARED_PKG_DIRS].map((pkg) => ({
    dir: `@repo/${pkg}`,
    types: "./dist/index.d.ts",
  })),
  ...SHARED_SUBPATHS.map((spec) => {
    const sub = spec.split("/")[2]!;
    return { dir: spec, types: `../dist/${sub}/index.d.ts` };
  }),
];

export type ExtraLib = { content: string; filePath: string };

let cached: Promise<ExtraLib[]> | null = null;

/** Loads the workspace .d.ts files as Monaco extraLibs. Cached after first call. */
export const loadPluginTypeDefs = (): Promise<ExtraLib[]> => {
  if (cached) return cached;

  cached = (async () => {
    const libs: ExtraLib[] = [];

    const entries = Object.entries(DTS_MODULES);
    const contents = await Promise.all(entries.map(([, load]) => load()));

    entries.forEach(([repoPath], i) => {
      const filePath = toMonacoPath(repoPath);
      const content = contents[i];
      if (!filePath || !content) return;
      libs.push({ content, filePath });
    });

    for (const { dir, types } of packageEntries()) {
      libs.push({
        content: JSON.stringify({ types, typings: types }),
        filePath: `file:///node_modules/${dir}/package.json`,
      });
    }

    // React types, mapped to where Monaco's resolver expects @types/react.
    const reactEntries = Object.entries(REACT_DTS_MODULES);
    const reactContents = await Promise.all(
      reactEntries.map(([, load]) => load()),
    );
    reactEntries.forEach(([repoPath], i) => {
      const name = repoPath.split("/").pop();
      const content = reactContents[i];
      if (!name || !content) return;
      libs.push({
        content,
        filePath: `file:///node_modules/@types/react/${name}`,
      });
    });

    return libs;
  })();

  return cached;
};
