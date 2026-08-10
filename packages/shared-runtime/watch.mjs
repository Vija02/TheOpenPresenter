import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, watch } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { entryFilesFor, sharedModulesFor } from "./modules.mjs";

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

  // Both conditions are collected: a package can emit ESM and CJS in separate
  // passes, and rebuilding while only one exists fails to resolve.
  const entries = new Set();
  for (const shared of sharedModulesFor(specifier)) {
    for (const file of entryFilesFor(shared)) entries.add(file);
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
  if (result.error || result.status !== 0) {
    // Kept alive: usually a transient half-written dist from the upstream
    // watcher, which the next change recovers from.
    const why = result.error ? ` (${result.error.message})` : "";
    console.error(`[shared-runtime] rebuild of ${specifier} failed${why}`);
  }
};

// Rebuilds only when an entry's CONTENT changed: tsup rewrites index.mjs on
// every phase even when the output is identical. All entries are hashed first,
// since `build.mjs --only` rebuilds the package's bundles together.
// Bounded so a package that never emits a declared entry cannot spin forever.
const MAX_INCOMPLETE_RETRIES = 50;
let incompleteRetries = 0;

const rebuildIfChanged = () => {
  // A build in flight has emptied the output directory. Rebuilding now would
  // fail to resolve, so wait for the writer to finish and re-check.
  if (!entryPaths.every(existsSync)) {
    if (incompleteRetries++ < MAX_INCOMPLETE_RETRIES) {
      schedule();
      return;
    }
    console.error(
      `[shared-runtime] ${specifier}: still missing ` +
        entryPaths.filter((p) => !existsSync(p)).join(", ") +
        ` after ${MAX_INCOMPLETE_RETRIES} checks; rebuilding anyway`,
    );
  }
  incompleteRetries = 0;

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

  // Build once at startup so the bundle matches whatever dist holds now, but
  // only once the entries stop changing. A sibling `vite build --watch` starts
  // at the same time and empties dist moments later; building into that window
  // fails, and Vite caches the resolution failure for the whole run.
  whenSettled(rebuildIfChanged);
};

/**
 * Calls `fn` once every entry exists and none has changed for a full interval,
 * so a build in flight is never mistaken for a finished one.
 */
function whenSettled(fn) {
  const SETTLE_MS = 600;
  let stableSince = null;
  let previous = "";

  const poll = setInterval(() => {
    if (!entryPaths.every(existsSync)) {
      stableSince = null;
      return;
    }
    const signature = entryPaths.map((p) => hashOf(p) ?? "?").join(":");
    if (signature !== previous) {
      previous = signature;
      stableSince = Date.now();
      return;
    }
    if (stableSince !== null && Date.now() - stableSince >= SETTLE_MS) {
      clearInterval(poll);
      fn();
    }
  }, 150);
}

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
