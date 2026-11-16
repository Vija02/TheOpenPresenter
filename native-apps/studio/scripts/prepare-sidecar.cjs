#!/usr/bin/env node
/**
 * Make the sidecars available before the shell starts: the runtime manager
 * and top-studio-helper. Without the manager, `npm run dev` launches an app whose
 * offline mode is dead, and the only clue is a status message in the UI.
 * Without the helper, remote access and clicker grabbing are.
 *
 * Packaged builds do not use this: CI compiles the sidecars per platform and
 * electron-builder copies them out of resources/.
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
const HELPER_DIR = resolve(__dirname, "../../studio-helper");
const RESOURCES = resolve(__dirname, "../resources");
const EXE = process.platform === "win32" ? ".exe" : "";
const BIN = `top-runtime-manager${EXE}`;
const HELPER_BIN = `top-studio-helper${EXE}`;

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
  const force = !!process.env.TOP_FORCE_SIDECAR;
  const needManager = force || !existsSync(join(RESOURCES, BIN));
  const needHelper = force || !existsSync(join(RESOURCES, HELPER_BIN));
  if (!needManager && !needHelper) {
    log(`already staged, leaving them alone: ${RESOURCES}`);
    log("set TOP_FORCE_SIDECAR=1 to rebuild them anyway");
    return;
  }

  if (spawnSync("cargo", ["--version"], { stdio: "ignore" }).status !== 0) {
    log("cargo not found — skipping. Offline mode will be unavailable.");
    log("Install Rust from https://rustup.rs to enable it.");
    return;
  }

  if (needManager) buildManager();
  if (needHelper) buildHelper();
}

function buildHelper() {
  log("building top-studio-helper (first build takes a minute)");
  const build = spawnSync("cargo", ["build", "--bin", "top-studio-helper"], {
    cwd: HELPER_DIR,
    stdio: "inherit",
  });
  if (build.status !== 0) {
    log("helper build failed — remote access will be unavailable");
    return;
  }
  mkdirSync(RESOURCES, { recursive: true });
  stageBinary(
    join(HELPER_DIR, "target/debug", HELPER_BIN),
    join(RESOURCES, HELPER_BIN),
  );
  log(`ready: ${join(RESOURCES, HELPER_BIN)}`);
}

function buildManager() {
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
