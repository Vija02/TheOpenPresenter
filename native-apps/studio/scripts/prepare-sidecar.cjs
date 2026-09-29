#!/usr/bin/env node
/**
 * Make the runtime manager sidecar available before the shell starts. Without
 * it, `npm run dev` launches an app whose offline mode is dead, and the only
 * clue is a status message in the UI.
 *
 * Packaged builds do not use this: CI compiles the sidecar per platform and
 * electron-builder copies it out of resources/.
 */
const { execFileSync, spawnSync } = require("child_process");
const {
  existsSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  renameSync,
  rmSync,
} = require("fs");
const { join, resolve } = require("path");

const MANAGER_DIR = resolve(__dirname, "../../runtime-manager");
const RESOURCES = resolve(__dirname, "../resources");
const EXE = process.platform === "win32" ? ".exe" : "";
const BIN = `top-runtime-manager${EXE}`;

function log(...args) {
  console.log("[sidecar]", ...args);
}

// A dev build needs a trusted key or the manager refuses to start. The same
// key signs locally published test releases, so it is generated once and kept
// rather than regenerated every build.
function ensureDevKey() {
  const pubPath = join(MANAGER_DIR, "dev-pubkey.txt");
  const privPath = join(MANAGER_DIR, "dev-private.key");
  if (existsSync(pubPath) && existsSync(privPath)) return;

  log("generating a development signing key");
  // Bootstrap problem: keygen is built by the same cargo invocation that needs
  // the key. It does not read the key itself, so build it alone first.
  execFileSync("cargo", ["build", "--bin", "top-runtime-keygen"], {
    cwd: MANAGER_DIR,
    stdio: "inherit",
  });

  const keygen = join(MANAGER_DIR, "target/debug", `top-runtime-keygen${EXE}`);
  const priv = execFileSync(keygen, ["--private"], { encoding: "utf8" }).trim();
  writeFileSync(privPath, priv);

  // Derived from the private half rather than running keygen twice, which
  // would produce two unrelated keys.
  const crypto = require("crypto");
  const pkcs8 = Buffer.concat([
    Buffer.from("302e020100300506032b657004220420", "hex"),
    Buffer.from(priv, "base64"),
  ]);
  const key = crypto.createPrivateKey({
    key: pkcs8,
    format: "der",
    type: "pkcs8",
  });
  const spki = crypto
    .createPublicKey(key)
    .export({ format: "der", type: "spki" });
  writeFileSync(pubPath, spki.subarray(spki.length - 32).toString("base64"));

  log(`wrote ${pubPath} (development only, not a release key)`);
}

function main() {
  if (spawnSync("cargo", ["--version"], { stdio: "ignore" }).status !== 0) {
    log("cargo not found — skipping. Offline mode will be unavailable.");
    log("Install Rust from https://rustup.rs to enable it.");
    return;
  }

  // An explicit key means "build a binary that trusts the real releases", so
  // the dev key is skipped entirely: build.rs prefers the variable anyway.
  const explicitKey = (process.env.TOP_RUNTIME_PUBKEY || "").trim();
  if (explicitKey) {
    log("using TOP_RUNTIME_PUBKEY from the environment");
  } else {
    ensureDevKey();
  }

  log("building the runtime manager (first build takes a minute)");
  const build = spawnSync("cargo", ["build", "--bin", "top-runtime-manager"], {
    cwd: MANAGER_DIR,
    stdio: "inherit",
    // Passed explicitly because `cargo build` would otherwise bake in
    // dev-pubkey.txt whatever the shell had set, leaving a binary that cannot
    // verify real releases.
    env: { ...process.env },
  });
  if (build.status !== 0) {
    log("build failed — offline mode will be unavailable");
    return;
  }

  // Into resources/ so dev and packaged builds resolve the sidecar the same
  // way, instead of dev relying on a path absent from a bundle.
  mkdirSync(RESOURCES, { recursive: true });
  stageBinary(join(MANAGER_DIR, "target/debug", BIN), join(RESOURCES, BIN));
  log(`ready: ${join(RESOURCES, BIN)}`);
}

/**
 * Copy the built sidecar into resources/. A running Electron holds the old
 * binary open, so a plain copy fails with EBUSY/ETXTBSY and leaves a stale
 * binary behind while the build still looks fine. Renaming the old one out of
 * the way first works even while mapped, because the handle follows the inode.
 */
function stageBinary(from, to) {
  try {
    copyFileSync(from, to);
    return;
  } catch (err) {
    if (
      err.code !== "ETXTBSY" &&
      err.code !== "EBUSY" &&
      err.code !== "EPERM"
    ) {
      throw err;
    }
  }

  const parked = `${to}.old`;
  try {
    rmSync(parked, { force: true });
    renameSync(to, parked);
    copyFileSync(from, to);
    // The running process keeps its handle to the parked inode; the file is
    // reclaimed when that process exits.
    rmSync(parked, { force: true });
    log("replaced a sidecar that was in use (an app is still running it)");
  } catch (err) {
    console.error(
      `\nCould not update ${to}: ${err.message}\n` +
        `Quit any running TheOpenPresenter app and run this again. ` +
        `Continuing would test a stale binary.`,
    );
    process.exit(1);
  }
}

main();
