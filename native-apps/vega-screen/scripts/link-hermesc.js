#!/usr/bin/env node
/*
 * Workaround for a known incompatibility between Vega SDK 0.22.x and the public
 * @amazon-devices/* npm packages:
 *
 *   - @amazon-devices/kepler-cli-platform looks for hermesc at
 *       node_modules/@amazon-devices/react-native-kepler/sdks/hermesc/<platform>/hermesc
 *     and only falls back to `vega path hermes` if it's missing.
 *   - The bundled `vega` CLI in 0.22.6759 still expects the legacy `@amzn/`
 *     package scope, so the fallback always fails.
 *   - The hermesc binary IS shipped inside the SDK but lives under a path
 *     that includes a host-arch subdir (e.g. .../build/x86_64-Linux/bin/),
 *     not the path the CLI fallback returns.
 *
 * This script links the actual hermesc binary into the location the
 * npm code path checks first, so the broken CLI fallback is never invoked.
 *
 * Idempotent. Safe to no-op in CI / environments where the SDK isn't installed.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

function log(msg) {
  // Prefix so it's obvious in install output
  console.log(`[link-hermesc] ${msg}`);
}

function bail(msg) {
  log(`skipped: ${msg}`);
  process.exit(0); // never fail an install
}

const hostOs = os.platform();
let platformDir;
if (hostOs === 'linux') platformDir = 'linux64-bin';
else if (hostOs === 'darwin') platformDir = 'osx-bin';
else bail(`unsupported host OS '${hostOs}'`);

// Resolve SDK root from $HOME/vega/config.json (Vega Version Manager layout).
const vegaHome = process.env.VEGA_HOME || path.join(os.homedir(), 'vega');
const configPath = path.join(vegaHome, 'config.json');
if (!fs.existsSync(configPath)) bail(`no Vega config at ${configPath}`);

let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (e) {
  bail(`could not parse ${configPath}: ${e.message}`);
}

const sdkRoot = config.sdkPath;
const defaultVersion = config.defaultVersion; // e.g. "main@0.22.6759"
if (!sdkRoot || !defaultVersion) bail(`config.json missing sdkPath or defaultVersion`);
const [channel, version] = defaultVersion.split('@');
if (!channel || !version) bail(`unexpected defaultVersion format: ${defaultVersion}`);

const sdkVersionDir = path.join(sdkRoot, 'vega-sdk', channel, version);
const hermesPkgDir = path.join(sdkVersionDir, 'packages', 'VegaUIReact-Hermes');
if (!fs.existsSync(hermesPkgDir)) bail(`VegaUIReact-Hermes not found in SDK at ${hermesPkgDir}`);

// Find the (single) versioned subdir, e.g. VegaUIReact-Hermes-0.72.x_vodka.264984.0
const versioned = fs.readdirSync(hermesPkgDir).find(d => d.startsWith('VegaUIReact-Hermes-'));
if (!versioned) bail(`no VegaUIReact-Hermes-* subdir inside ${hermesPkgDir}`);

// Glob the actual hermesc binary. Layout has been seen as:
//   .../AL2_x86_64/DEV.STD.PTHREAD/build/x86_64-Linux/bin/hermesc
// but the arch subdirs can shift between SDK releases, so search.
function findHermesc(dir) {
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try { entries = fs.readdirSync(cur, { withFileTypes: true }); } catch { continue; }
    for (const ent of entries) {
      const full = path.join(cur, ent.name);
      if (ent.isDirectory()) {
        stack.push(full);
      } else if (ent.name === 'hermesc' && (ent.isFile() || ent.isSymbolicLink())) {
        return full;
      }
    }
  }
  return null;
}

const realHermesc = findHermesc(path.join(hermesPkgDir, versioned));
if (!realHermesc) bail(`could not locate hermesc binary inside ${versioned}`);

// Destination inside react-native-kepler.
const rnKeplerDir = path.dirname(
  require.resolve('@amazon-devices/react-native-kepler/package.json', {
    paths: [path.resolve(__dirname, '..')],
  }),
);
const linkDir = path.join(rnKeplerDir, 'sdks', 'hermesc', platformDir);
const linkPath = path.join(linkDir, 'hermesc');

fs.mkdirSync(linkDir, { recursive: true });

// Replace existing link/file to keep this idempotent.
try { fs.unlinkSync(linkPath); } catch (_) { /* not present */ }

try {
  fs.symlinkSync(realHermesc, linkPath);
  log(`linked ${linkPath} -> ${realHermesc}`);
} catch (e) {
  // On platforms where symlinks aren't allowed, fall back to a hard copy.
  try {
    fs.copyFileSync(realHermesc, linkPath);
    fs.chmodSync(linkPath, 0o755);
    log(`copied ${realHermesc} -> ${linkPath} (symlink failed: ${e.message})`);
  } catch (e2) {
    bail(`could not create link or copy: ${e2.message}`);
  }
}
