import { ALL_SHARED_SPECIFIERS, isSharedModule } from "@repo/shared-modules";
import * as esbuild from "esbuild";

import { scopeCss } from "./cssScope";
import { remoteEntrySource, rendererEntrySource } from "./entry";
import {
  REMOTE_CSS_FILE,
  REMOTE_JS_FILE,
  RENDERER_CSS_FILE,
  RENDERER_JS_FILE,
  clientPluginVersionName,
  cssScopeSelector,
} from "./naming";
import { buildPluginTailwind } from "./tailwind";

const RESOLVE_DIR =
  typeof __dirname !== "undefined" ? __dirname : process.cwd();

export type ClientPluginSource = Record<string, string>;

export type BuiltFile = {
  filename: string;
  content: string;
  contentType: string;
};

export type BuildResult =
  | { ok: true; files: BuiltFile[]; log: string }
  | { ok: false; log: string };

// --- Safety limits ---------------------------------------------------------
const MAX_SOURCE_BYTES = 2 * 1024 * 1024; // 2MB of authored source
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024; // 8MB of built output
const BUILD_TIMEOUT_MS = 30_000;

// Block some pattern for security
const FORBIDDEN_PATTERNS: { re: RegExp; reason: string }[] = [
  {
    re: /\bdocument\s*\.\s*cookie\b/,
    reason: "document.cookie is not allowed",
  },
  {
    re: /\blocalStorage\b/,
    reason: "localStorage is not allowed; use the plugin storage API",
  },
  { re: /\bsessionStorage\b/, reason: "sessionStorage is not allowed" },
  { re: /\bXMLHttpRequest\b/, reason: "XMLHttpRequest is not allowed" },
  { re: /\bimport\s*\(/, reason: "dynamic import() is not allowed" },
  { re: /\beval\s*\(/, reason: "eval is not allowed" },
  { re: /\b__APP_DATA__\b/, reason: "accessing __APP_DATA__ is not allowed" },
];

const isServerOnlyImport = (id: string) =>
  id === "@repo/base-plugin/server" || id === "@repo/layout/ai";

const ALLOWED_BUNDLED_PREFIXES = ["@r2wc/"];

const isAllowedBundled = (id: string) =>
  ALLOWED_BUNDLED_PREFIXES.some((p) => id === p || id.startsWith(p));

const isAllowedRemoteImport = (id: string) => {
  try {
    const url = new URL(id);
    return (
      url.protocol === "https:" &&
      url.hostname === "esm.sh" &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
};

// --- Static source validation ---------------------------------------------
function validateSource(source: ClientPluginSource): string | null {
  let total = 0;
  for (const [filename, content] of Object.entries(source)) {
    total += Buffer.byteLength(content, "utf8");
    for (const { re, reason } of FORBIDDEN_PATTERNS) {
      if (re.test(content)) {
        return `${filename}: ${reason}`;
      }
    }
  }
  if (total > MAX_SOURCE_BYTES) {
    return `Source too large: ${total} bytes (max ${MAX_SOURCE_BYTES})`;
  }
  return null;
}

// --- esbuild plugins -------------------------------------------------------

// Resolves the author's virtual files + the injected entries from an
// in-memory map, and marks shared / disallowed specifiers appropriately.
function inMemoryPlugin(
  files: Record<string, string>,
  onDisallowed: (id: string) => void,
): esbuild.Plugin {
  return {
    name: "cplugin-in-memory",
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        const id = args.path;

        // Virtual files (entries + author code + shared source).
        if (files[id] !== undefined) {
          return { path: id, namespace: "cplugin" };
        }
        // Relative import from a virtual file -> another virtual file.
        if (args.namespace === "cplugin" && id.startsWith("./")) {
          const key = id.replace(/^\.\//, "");
          for (const candidate of [
            key,
            `${key}.tsx`,
            `${key}.ts`,
            `${key}.jsx`,
            `${key}.js`,
          ]) {
            if (files[candidate] !== undefined) {
              return { path: candidate, namespace: "cplugin" };
            }
          }
          onDisallowed(id);
          return { path: id, external: true };
        }

        if (isAllowedRemoteImport(id)) {
          return { path: id, external: true };
        }

        // Bare specifiers.
        if (isServerOnlyImport(id)) {
          onDisallowed(id);
          return { path: id, external: true };
        }
        // Trusted entry deps: resolve from node_modules and bundle.
        if (isAllowedBundled(id)) {
          return undefined;
        }
        // CSS imports are handled/bundled by esbuild.
        if (id.endsWith(".css")) {
          return undefined;
        }
        // Shared modules (react, @repo/layout, ...) come from the import map.
        if (isSharedModule(id) || ALL_SHARED_SPECIFIERS.includes(id)) {
          return { path: id, external: true };
        }
        // Subpaths of shared packages, e.g. `@repo/layout/react`.
        const base = id.split("/").slice(0, 2).join("/");
        if (ALL_SHARED_SPECIFIERS.includes(base) || isSharedModule(base)) {
          return { path: id, external: true };
        }

        // Anything else is a disallowed npm dependency.
        onDisallowed(id);
        return { path: id, external: true };
      });

      build.onLoad({ filter: /.*/, namespace: "cplugin" }, (args) => {
        const contents = files[args.path]!;
        const loader: esbuild.Loader = args.path.endsWith(".css")
          ? "css"
          : args.path.endsWith(".ts")
            ? "ts"
            : "tsx";
        return { contents, loader, resolveDir: RESOLVE_DIR };
      });
    },
  };
}

async function buildEntry(
  clientPluginId: string,
  versionId: string,
  entryFileName: string,
  entrySource: string,
  authorVirtualName: string,
  authorFileName: string,
  source: ClientPluginSource,
): Promise<{ js: string; css: string; disallowed: string[] }> {
  const disallowed: string[] = [];

  // Assemble the virtual FS: the injected entry, the author's component under a
  // stable name, plus every other authored file (shared modules between entries).
  const files: Record<string, string> = {
    [entryFileName]: entrySource,
    [authorVirtualName]: source[authorFileName] ?? "",
  };
  for (const [name, content] of Object.entries(source)) {
    if (name === authorFileName) continue;
    files[name] = content;
  }

  const result = await esbuild.build({
    entryPoints: [entryFileName],
    bundle: true,
    format: "esm",
    target: "esnext",
    write: false,
    outdir: "cplugin-out",
    jsx: "automatic",
    minify: true,
    legalComments: "none",
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "silent",
    plugins: [inMemoryPlugin(files, (id) => disallowed.push(id))],
  });

  let js = "";
  let css = "";
  for (const out of result.outputFiles ?? []) {
    if (out.path.endsWith(".css")) css += out.text;
    else js += out.text;
  }

  css = (await buildPluginTailwind(source)) + css;

  // Namespace CSS so a plugin can't restyle the host.
  if (css.trim()) {
    css = await scopeCss(css, cssScopeSelector(clientPluginId, versionId));
  }

  return { js, css, disallowed };
}

export async function buildClientPlugin(
  clientPluginId: string,
  versionId: string,
  source: ClientPluginSource,
): Promise<BuildResult> {
  const validationError = validateSource(source);
  if (validationError) {
    return { ok: false, log: validationError };
  }

  const versionName = clientPluginVersionName(clientPluginId, versionId);

  try {
    const build = Promise.all([
      buildEntry(
        clientPluginId,
        versionId,
        "__entry_remote.tsx",
        remoteEntrySource(versionName),
        "__author_remote.tsx",
        "remote.tsx",
        source,
      ),
      buildEntry(
        clientPluginId,
        versionId,
        "__entry_renderer.tsx",
        rendererEntrySource(versionName),
        "__author_renderer.tsx",
        "renderer.tsx",
        source,
      ),
    ]);

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Build timed out after ${BUILD_TIMEOUT_MS}ms`)),
        BUILD_TIMEOUT_MS,
      ),
    );

    const [remote, renderer] = await Promise.race([build, timeout]);

    const disallowed = [
      ...new Set([...remote.disallowed, ...renderer.disallowed]),
    ];
    if (disallowed.length > 0) {
      return {
        ok: false,
        log: `Disallowed imports (only shared modules and static https://esm.sh imports are available to client plugins): ${disallowed.join(", ")}`,
      };
    }

    const files: BuiltFile[] = [
      {
        filename: REMOTE_JS_FILE,
        content: remote.js,
        contentType: "application/javascript",
      },
      {
        filename: RENDERER_JS_FILE,
        content: renderer.js,
        contentType: "application/javascript",
      },
    ];
    if (remote.css.trim()) {
      files.push({
        filename: REMOTE_CSS_FILE,
        content: remote.css,
        contentType: "text/css",
      });
    }
    if (renderer.css.trim()) {
      files.push({
        filename: RENDERER_CSS_FILE,
        content: renderer.css,
        contentType: "text/css",
      });
    }

    const totalOutput = files.reduce(
      (acc, f) => acc + Buffer.byteLength(f.content, "utf8"),
      0,
    );
    if (totalOutput > MAX_OUTPUT_BYTES) {
      return {
        ok: false,
        log: `Built output too large: ${totalOutput} bytes (max ${MAX_OUTPUT_BYTES})`,
      };
    }

    return { ok: true, files, log: "Build succeeded" };
  } catch (err: any) {
    return { ok: false, log: err?.message ?? String(err) };
  }
}
