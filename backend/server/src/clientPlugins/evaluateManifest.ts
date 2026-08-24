import * as esbuild from "esbuild";
import path from "path";
import vm from "vm";

export type PluginManifest = {
  pluginData: Record<string, unknown>;
  rendererData: Record<string, unknown>;
};

export const EMPTY_MANIFEST: PluginManifest = {
  pluginData: {},
  rendererData: {},
};

const EVAL_TIMEOUT_MS = 2_000;
const BUILD_TIMEOUT_MS = 15_000;

const RESOLVE_DIR =
  typeof __dirname !== "undefined" ? __dirname : process.cwd();

/** Resolves the plugin's own files from memory; everything else from disk. */
const inMemory = (files: Record<string, string>): esbuild.Plugin => ({
  name: "cplugin-manifest",
  setup(build) {
    build.onResolve({ filter: /.*/ }, (args) => {
      const id = args.path;
      if (files[id] !== undefined) return { path: id, namespace: "cplugin" };

      if (args.namespace === "cplugin" && id.startsWith("./")) {
        const key = id.replace(/^\.\//, "");
        for (const candidate of [
          key,
          `${key}.ts`,
          `${key}.tsx`,
          `${key}.js`,
          `${key}.jsx`,
        ]) {
          if (files[candidate] !== undefined) {
            return { path: candidate, namespace: "cplugin" };
          }
        }
        return { path: id, external: true };
      }
      return undefined;
    });

    build.onLoad({ filter: /.*/, namespace: "cplugin" }, (args) => ({
      contents: files[args.path]!,
      loader: args.path.endsWith(".ts") ? "ts" : "tsx",
      resolveDir: RESOLVE_DIR,
    }));
  },
});

const isPlainData = (value: unknown): boolean => {
  if (value === null) return true;
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean") return true;
  if (Array.isArray(value)) return value.every(isPlainData);
  if (t === "object") {
    return Object.values(value as Record<string, unknown>).every(isPlainData);
  }
  return false;
};

/** Keeps only keys that survive a jsonb round trip. */
const asSeedObject = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (isPlainData(entry)) out[key] = entry;
  }
  return out;
};

/**
 * Builds and runs the manifest
 */
export const evaluateManifest = async (
  source: Record<string, string>,
  manifestEntry: string,
): Promise<{ manifest: PluginManifest; log: string | null }> => {
  if (source[manifestEntry] === undefined) {
    return { manifest: EMPTY_MANIFEST, log: null };
  }

  let bundled: string;
  try {
    const result = await esbuild.build({
      entryPoints: [manifestEntry],
      bundle: true,
      format: "cjs",
      platform: "node",
      target: "es2022",
      write: false,
      logLevel: "silent",
      absWorkingDir: path.resolve(RESOLVE_DIR),
      plugins: [inMemory(source)],
    });
    bundled = result.outputFiles?.[0]?.text ?? "";
  } catch (err: any) {
    return {
      manifest: EMPTY_MANIFEST,
      log: `Could not bundle ${manifestEntry}: ${err?.message ?? err}`,
    };
  }

  if (!bundled.trim()) return { manifest: EMPTY_MANIFEST, log: null };

  try {
    const module = { exports: {} as Record<string, unknown> };
    const context = vm.createContext({
      module,
      exports: module.exports,
      process: { env: { NODE_ENV: "production" } },
      console: { log: () => {}, warn: () => {}, error: () => {} },
    });

    new vm.Script(bundled, { filename: manifestEntry }).runInContext(context, {
      timeout: EVAL_TIMEOUT_MS,
    });

    const exported = module.exports.manifest as
      | Record<string, unknown>
      | undefined;
    if (!exported) {
      return {
        manifest: EMPTY_MANIFEST,
        log: `${manifestEntry} does not export \`manifest\`.`,
      };
    }

    return {
      manifest: {
        pluginData: asSeedObject(exported.pluginData),
        rendererData: asSeedObject(exported.rendererData),
      },
      log: null,
    };
  } catch (err: any) {
    return {
      manifest: EMPTY_MANIFEST,
      log: `Could not evaluate ${manifestEntry}: ${err?.message ?? err}`,
    };
  }
};

export const MANIFEST_BUILD_TIMEOUT_MS = BUILD_TIMEOUT_MS;
