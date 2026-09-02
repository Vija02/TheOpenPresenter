import fs from "fs";
import path from "path";

/**
 * Reads the real .d.ts of the modules a client plugin may import.
 */

const MAX_CHARS = 8_000;

/** Barrels re-export, so follow `export * from "./x"` to find real declarations. */
const REEXPORT_RE = /export\s+\*\s+from\s+["'](\.[^"']+)["']/g;

const packageNameOf = (specifier: string) => {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]!;
};

const findPackageDir = (pkgName: string, fromDir: string) => {
  let dir = fromDir;
  for (;;) {
    const candidate = path.join(dir, "node_modules", ...pkgName.split("/"));
    if (fs.existsSync(path.join(candidate, "package.json"))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
};

const typeCandidates = (exportsNode: unknown): string[] => {
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (typeof node === "string") {
      out.push(node);
      return;
    }
    if (!node || typeof node !== "object") return;
    for (const key of ["types", "import", "require", "default"]) {
      if (key in (node as Record<string, unknown>)) {
        walk((node as Record<string, unknown>)[key]);
      }
    }
  };
  walk(exportsNode);
  return out;
};

const asDeclarationPath = (dir: string, candidate: string) => {
  const variants = [
    candidate,
    candidate.replace(/\.mjs$/, ".d.mts"),
    candidate.replace(/\.cjs$/, ".d.cts"),
    candidate.replace(/\.jsx?$/, ".d.ts"),
  ];
  for (const variant of variants) {
    if (!/\.d\.(m|c)?ts$/.test(variant)) continue;
    const abs = path.resolve(dir, variant);
    if (fs.existsSync(abs)) return abs;
  }
  return null;
};

/** Absolute path to a specifier's type declarations, or null. */
export const resolveTypesFile = (
  specifier: string,
  fromDir: string,
): string | null => {
  const pkgName = packageNameOf(specifier);
  const rest = specifier.split("/").slice(pkgName.split("/").length);
  const subpath = rest.length === 0 ? "." : `./${rest.join("/")}`;

  const dir = findPackageDir(pkgName, fromDir);
  if (!dir) return null;

  const pkg = JSON.parse(
    fs.readFileSync(path.join(dir, "package.json"), "utf8"),
  ) as Record<string, any>;

  const candidates: string[] = [];
  if (pkg.exports?.[subpath] !== undefined) {
    candidates.push(...typeCandidates(pkg.exports[subpath]));
  }
  if (subpath === ".") {
    for (const key of ["types", "typings", "main", "module"]) {
      if (typeof pkg[key] === "string") candidates.push(pkg[key]);
    }
  }

  for (const candidate of candidates) {
    const found = asDeclarationPath(dir, candidate);
    if (found) return found;
  }

  // Untyped packages (react, react-dom) carry types in a @types package.
  const typesDir = findPackageDir(
    `@types/${pkgName.replace(/^@/, "").replace("/", "__")}`,
    fromDir,
  );
  if (typesDir) {
    const entry = rest.length ? `${rest.join("/")}.d.ts` : "index.d.ts";
    const abs = path.join(typesDir, entry);
    if (fs.existsSync(abs)) return abs;
  }
  return null;
};

/** A declaration file plus every barrel it re-exports, in order. */
export const collectDeclarations = (
  entryFile: string,
  maxFiles = 60,
): { file: string; text: string }[] => {
  const seen = new Set<string>();
  const queue = [entryFile];
  const out: { file: string; text: string }[] = [];

  while (queue.length > 0 && out.length < maxFiles) {
    const current = queue.shift()!;
    if (seen.has(current)) continue;
    seen.add(current);
    if (!fs.existsSync(current)) continue;

    const text = fs.readFileSync(current, "utf8");
    out.push({ file: current, text });

    const dir = path.dirname(current);
    for (const match of text.matchAll(REEXPORT_RE)) {
      const target = match[1]!;
      for (const suffix of [".d.ts", ".d.mts", "/index.d.ts", ""]) {
        const abs = path.resolve(dir, target + suffix);
        if (fs.existsSync(abs) && /\.d\.(m|c)?ts$/.test(abs)) {
          queue.push(abs);
          break;
        }
      }
    }
  }
  return out;
};

export const truncate = (text: string) =>
  text.length <= MAX_CHARS
    ? text
    : `${text.slice(0, MAX_CHARS)}\n\n... truncated at ${MAX_CHARS} chars. Read a specific symbol instead.`;
