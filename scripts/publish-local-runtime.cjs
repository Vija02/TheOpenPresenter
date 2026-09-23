#!/usr/bin/env node
/**
 * Publish a runtime from this checkout into a local directory, so offline
 * mode can be tested without a CDN.
 *
 * This is a convenience wrapper, not the implementation: assembly,
 * signing, hashing and packing all live in `top-runtime-publish`, driven
 * by runtime.toml beside this script. All this adds is building the tool
 * first, which is the one thing a Rust binary cannot do for itself.
 *
 *   yarn publish:runtime
 *   yarn publish:runtime --version 1.2.3 --out /tmp/cdn
 */
const { execFileSync } = require("child_process");
const { mkdirSync } = require("fs");
const { homedir } = require("os");
const { join, resolve } = require("path");

const REPO = resolve(__dirname, "..");
const MANAGER = join(REPO, "native-apps/runtime-manager");
const EXE = process.platform === "win32" ? ".exe" : "";

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index !== -1 ? process.argv[index + 1] : fallback;
}

const VERSION = arg("--version", "0.0.1-dev");
const OUT = resolve(arg("--out", join(homedir(), ".theopenpresenter-dev-cdn")));

console.log("[publish] building the publisher");
execFileSync("cargo", ["build", "--bin", "top-runtime-publish"], {
  cwd: MANAGER,
  stdio: "inherit",
});

mkdirSync(OUT, { recursive: true });

console.log(`[publish] publishing ${VERSION} to ${OUT}`);
execFileSync(
  join(MANAGER, "target/debug", `top-runtime-publish${EXE}`),
  [
    "build",
    "--repo",
    REPO,
    "--version",
    VERSION,
    "--schema",
    arg("--schema", "1"),
    "--channel",
    arg("--channel", "stable"),
    "--out",
    OUT,
    // Generates a gitignored development key on first use. Release
    // signing uses a real key from a secret, never this one.
    "--dev-key",
  ],
  { stdio: "inherit" },
);

console.log(`[publish] done. Point the app at ${OUT}`);
console.log(`[publish]   or: TOP_RUNTIME_SOURCE=${OUT}`);
