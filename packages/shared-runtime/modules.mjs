import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Parsed rather than imported because the build driver runs under plain node
// with no TypeScript loader. The Vite config imports it properly.
const readSpecifiers = () => {
  const source = readFileSync(
    resolve(__dirname, "../shared-modules/src/index.ts"),
    "utf8",
  );
  const specifiers = [
    ...source.matchAll(/^\s*specifier:\s*"([^"]+)"/gm),
  ].map((m) => m[1]);

  if (specifiers.length === 0) {
    throw new Error("Could not parse any specifiers from @repo/shared-modules");
  }
  return specifiers;
};

/** Output filename stem for a specifier, matching vite.config.ts. */
export const safeNameFor = (specifier) =>
  specifier.replace(/^@/, "").replace(/[/]/g, "__");

/**
 * The dist files a shared specifier resolves to, both conditions.
 *
 * Packages emit ESM and CJS in separate passes, so a build started while only
 * one exists fails to resolve. Returns [] for anything not resolvable here,
 * such as a package outside the workspace.
 */
export const entryFilesFor = (specifier) => {
  const [scope, name, ...rest] = specifier.split("/");
  const pkgName = specifier.startsWith("@") ? `${scope}/${name}` : scope;
  const subpath = specifier.startsWith("@")
    ? rest.length
      ? "./" + rest.join("/")
      : "."
    : [name, ...rest].filter(Boolean).length
      ? "./" + [name, ...rest].filter(Boolean).join("/")
      : ".";

  // `${pkg}/package.json` is not always in a package's `exports`, so walk up
  // from a resolved file instead.
  const require = createRequire(resolve(__dirname, "package.json"));
  let pkgDir;
  try {
    pkgDir = dirname(require.resolve(`${pkgName}/package.json`));
  } catch {
    try {
      let dir = dirname(require.resolve(pkgName));
      while (dir !== dirname(dir) && !existsSync(resolve(dir, "package.json"))) {
        dir = dirname(dir);
      }
      pkgDir = dir;
    } catch {
      return [];
    }
  }

  let pkg;
  try {
    pkg = JSON.parse(readFileSync(resolve(pkgDir, "package.json"), "utf8"));
  } catch {
    return [];
  }

  const e = pkg.exports?.[subpath];
  const candidates = [
    e?.import?.default ?? e?.import,
    e?.require?.default ?? e?.require,
    e?.default,
    typeof e === "string" ? e : undefined,
    subpath === "." ? (pkg.module ?? pkg.main) : undefined,
  ].filter((f) => typeof f === "string");

  return [...new Set(candidates)].map((f) => resolve(pkgDir, f));
};

/**
 * The shared bundles to rebuild for a given workspace package: its own entries
 * only, subpaths included. Dependents are deliberately not rebuilt; see
 * README.md. Passing no package returns everything.
 */
export const sharedModulesFor = (pkg) => {
  const specifiers = readSpecifiers();
  if (!pkg) return specifiers;

  const matched = specifiers.filter(
    (s) => s === pkg || s.startsWith(pkg + "/"),
  );
  if (matched.length === 0) {
    throw new Error(
      `"${pkg}" is not a shared module. Known:\n${specifiers.map((s) => "  " + s).join("\n")}`,
    );
  }
  return matched;
};
