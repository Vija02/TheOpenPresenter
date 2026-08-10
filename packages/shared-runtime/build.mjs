import { spawnSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { entryFilesFor, safeNameFor, sharedModulesFor } from "./modules.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../../backend/server/public/assets/shared");

// `--only <pkg>` rebuilds just one package's bundles, for watch mode.
const onlyIndex = process.argv.indexOf("--only");
const only = onlyIndex === -1 ? undefined : process.argv[onlyIndex + 1];

let specifiers;
try {
  specifiers = sharedModulesFor(only);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

if (process.argv.includes("--clean")) {
  if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true });
  console.log("Cleaned " + OUT_DIR);
  process.exit(0);
}

// A partial build defers cleanup of stale hashes until after it succeeds; a
// full build wipes the directory up front. See README.md.
const preExisting =
  only && existsSync(OUT_DIR)
    ? readdirSync(OUT_DIR).filter((file) =>
        specifiers.map(safeNameFor).some((stem) => file.startsWith(stem + "-")),
      )
    : [];

if (!only && existsSync(OUT_DIR)) {
  rmSync(OUT_DIR, { recursive: true });
}

console.log(
  only
    ? `Rebuilding ${specifiers.length} shared bundle(s) for ${only}\n`
    : `Building ${specifiers.length} shared modules -> ${OUT_DIR}\n`,
);

const buildOnce = (specifier) =>
  // One process per module, so Rollup cannot hoist common code into chunks.
  spawnSync("yarn", ["vite", "build", "--config", "vite.config.ts"], {
    cwd: __dirname,
    env: { ...process.env, MODULE: specifier },
    stdio: "inherit",
    shell: true,
  });

// A source package running `vite build --watch` empties its own dist while this
// build is in flight, so a module can fail purely because its entry vanished
// mid-run. Those failures are transient and clear once the writer settles.
const RETRIES = 3;
const RETRY_DELAY_MS = 750;

// Blocking sleep via a real syscall: a busy-wait would starve the very build
// this is waiting on, since the loop below is synchronous.
const sleep = (ms) => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
};

/**
 * Blocks until a module's package entries are all present and unchanged for a
 * short window, so a build is never started into a half-written dist. Returns
 * false if they never settle.
 */
const waitForEntries = (specifier) => {
  const files = entryFilesFor(specifier);
  if (files.length === 0) return true;

  const stamp = () =>
    files
      .map((f) => {
        try {
          const s = statSync(f);
          return `${s.size}@${s.mtimeMs}`;
        } catch {
          return "-";
        }
      })
      .join("|");

  // Must stay stable across several consecutive checks, not just two. Vite
  // spends over a second starting up before it resolves anything, so a single
  // stable reading is not enough to know a rebuild will not begin meanwhile.
  const REQUIRED_STABLE_CHECKS = 6;
  let previous = null;
  let stable = 0;

  for (let i = 0; i < 120; i++) {
    if (files.every((f) => existsSync(f))) {
      const current = stamp();
      if (current === previous) {
        if (++stable >= REQUIRED_STABLE_CHECKS) return true;
      } else {
        previous = current;
        stable = 0;
      }
    } else {
      previous = null;
      stable = 0;
    }
    sleep(250);
  }
  return false;
};

const failed = [];
for (const [i, specifier] of specifiers.entries()) {
  const label = `[${i + 1}/${specifiers.length}] ${specifier}`;
  console.log(label);

  let result;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    // Checked before every attempt, not just after a failure: the source
    // package's own watcher may have emptied dist since the previous module.
    waitForEntries(specifier);

    result = buildOnce(specifier);
    if (!result.error && result.status === 0) break;

    if (attempt < RETRIES) {
      console.error(
        `  ${specifier} failed (attempt ${attempt}/${RETRIES}); ` +
          `the source package is probably mid-rebuild, retrying...\n`,
      );
      sleep(RETRY_DELAY_MS);
    }
  }

  // `error` is set when the process could not be spawned at all, in which case
  // `status` is null. Reported explicitly, or the cause is invisible.
  if (result.error) {
    failed.push(specifier);
    console.error(
      `  FAILED to spawn: ${specifier} (${result.error.message})\n`,
    );
  } else if (result.status !== 0) {
    failed.push(specifier);
    console.error(`  FAILED: ${specifier} (exit ${result.status})\n`);
  }
}

if (failed.length > 0) {
  console.error(`\n${failed.length} module(s) failed:`);
  for (const f of failed) console.error("  - " + f);
  process.exit(1);
}

const manifest = JSON.parse(
  readFileSync(join(OUT_DIR, "importmap.json"), "utf8"),
);

const referenced = new Set(
  Object.values(manifest.imports).map((url) => url.split("/").pop()),
);
for (const file of preExisting) {
  const base = file.replace(/\.map$/, "");
  if (!referenced.has(base)) unlinkSync(join(OUT_DIR, file));
}

console.log(
  `\nDone. importmap.json has ${Object.keys(manifest.imports).length} entries.`,
);
