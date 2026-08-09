import { readFileSync } from "node:fs";
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
