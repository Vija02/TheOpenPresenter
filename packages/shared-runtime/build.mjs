import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync, readFileSync, unlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { safeNameFor, sharedModulesFor } from "./modules.mjs";

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
        specifiers
          .map(safeNameFor)
          .some((stem) => file.startsWith(stem + "-")),
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

const failed = [];
for (const [i, specifier] of specifiers.entries()) {
  const label = `[${i + 1}/${specifiers.length}] ${specifier}`;
  console.log(label);

  // One process per module, so Rollup cannot hoist common code into chunks.
  const result = spawnSync(
    "yarn",
    ["vite", "build", "--config", "vite.config.ts"],
    {
      cwd: __dirname,
      env: { ...process.env, MODULE: specifier },
      stdio: "inherit",
      shell: true,
    },
  );

  // `error` is set when the process could not be spawned at all, in which case
  // `status` is null. Reported explicitly, or the cause is invisible.
  if (result.error) {
    failed.push(specifier);
    console.error(`  FAILED to spawn: ${specifier} (${result.error.message})\n`);
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

const manifest = JSON.parse(readFileSync(join(OUT_DIR, "importmap.json"), "utf8"));

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
