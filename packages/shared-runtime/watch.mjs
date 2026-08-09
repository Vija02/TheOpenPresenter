import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, watch } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { sharedModulesFor } from "./modules.mjs";

// Rebuilds a package's shared bundles whenever its dist output changes.
// Usage: node watch.mjs <specifier> [entryFile]. See README.md.

const __dirname = dirname(fileURLToPath(import.meta.url));

const [specifier, entryArg] = process.argv.slice(2);
if (!specifier) {
  console.error("Usage: node watch.mjs <specifier> [entryFile]");
  process.exit(1);
}

// Fail immediately rather than watching forever and never rebuilding.
try {
  sharedModulesFor(specifier);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

/**
 * The files the shared build actually reads: one per shared specifier, subpaths
 * included since `.` and `./client` resolve to different dist files.
 */
const resolveEntries = () => {
  if (entryArg) return [resolve(process.cwd(), entryArg)];

  const pkg = JSON.parse(
    readFileSync(join(process.cwd(), "package.json"), "utf8"),
  );

  const fileFor = (subpath) => {
    const e = pkg.exports?.[subpath];
    const file =
      e?.import?.default ??
      e?.import ??
      e?.default ??
      (typeof e === "string" ? e : undefined) ??
      (subpath === "." ? (pkg.module ?? pkg.main) : undefined);
    return typeof file === "string" ? file : undefined;
  };

  // "@repo/video" -> ".", "@repo/video/client" -> "./client".
  const entries = new Set();
  for (const shared of sharedModulesFor(specifier)) {
    const rest = shared.slice(specifier.length);
    const file = fileFor(rest === "" ? "." : "." + rest);
    if (file) entries.add(resolve(process.cwd(), file));
  }

  if (entries.size === 0) {
    throw new Error(
      `Could not determine the ESM entry for ${specifier} from package.json. ` +
        `Pass it explicitly: node watch.mjs ${specifier} dist/index.mjs`,
    );
  }
  return [...entries];
};

let entryPaths;
try {
  entryPaths = resolveEntries();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

// One watch per directory containing an entry; subpaths often live in their own.
const entryDirs = [...new Set(entryPaths.map((p) => dirname(p)))];

const hashOf = (path) => {
  try {
    return createHash("sha1").update(readFileSync(path)).digest("hex");
  } catch {
    return null;
  }
};

const lastHashes = new Map();

const rebuild = () => {
  const result = spawnSync(
    "node",
    [resolve(__dirname, "build.mjs"), "--only", specifier],
    { cwd: __dirname, stdio: "inherit" },
  );
  if (result.status !== 0) {
    // Kept alive: usually a transient half-written dist from the upstream
    // watcher, which the next change recovers from.
    console.error(`[shared-runtime] rebuild of ${specifier} failed`);
  }
};

// Rebuilds only when an entry's CONTENT changed: tsup rewrites index.mjs on
// every phase even when the output is identical. All entries are hashed first,
// since `build.mjs --only` rebuilds the package's bundles together.
const rebuildIfChanged = () => {
  let changed = false;
  for (const path of entryPaths) {
    const hash = hashOf(path);
    if (hash === null || hash === lastHashes.get(path)) continue;
    lastHashes.set(path, hash);
    changed = true;
  }
  if (changed) rebuild();
};

// Coalesces the burst of events a single upstream build produces, so the hash
// is read once the writer has settled rather than mid-write.
let timer;
const schedule = () => {
  clearTimeout(timer);
  timer = setTimeout(rebuildIfChanged, 200);
};

const watched = new Set();

const watchDir = (dir) => {
  if (watched.has(dir) || !existsSync(dir)) return;
  watched.add(dir);
  // The directory, not the file: tools replace files by rename, which detaches
  // a file-level watch.
  watch(dir, (_event, filename) => {
    if (!filename || !entryPaths.includes(join(dir, filename))) return;
    schedule();
  });
};

const start = () => {
  console.log(
    `[shared-runtime] watching ${entryPaths.length} entr${entryPaths.length === 1 ? "y" : "ies"} for ${specifier}`,
  );
  for (const dir of entryDirs) watchDir(dir);

  // Build once at startup so the bundle matches whatever dist holds now.
  rebuildIfChanged();
};

if (entryDirs.every((d) => existsSync(d))) {
  start();
} else {
  console.log(`[shared-runtime] waiting for ${specifier} output to appear`);
  const poll = setInterval(() => {
    if (entryDirs.every((d) => existsSync(d))) {
      clearInterval(poll);
      start();
    }
  }, 500);
}
