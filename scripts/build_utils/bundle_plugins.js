/**
 * Bundles each plugin's server-side dist/index.js with its pure-JS dependencies
 * into a single file using esbuild. This is analogous to bundle_server.js but
 * for plugins — it inlines packages like youtubei.js, mupdf-wasm helpers, etc.
 * so that NFT only traces the shared/native externals.
 *
 * Run: node scripts/build_utils/bundle_plugins.js
 * (called in the Dockerfile after all plugins are built, before extract_plugins)
 */

const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs");

const projectRoot = path.resolve(__dirname, "../..");
const pluginsDir = path.join(projectRoot, "plugins");

async function main() {
  if (!fs.existsSync(pluginsDir)) {
    console.log("bundle_plugins: plugins/ directory not found, skipping.");
    return;
  }

  const pluginEntries = fs
    .readdirSync(pluginsDir)
    .filter((name) => {
      const entry = path.join(pluginsDir, name, "dist/index.js");
      return fs.existsSync(entry);
    })
    .map((name) => ({
      name,
      entry: path.join(pluginsDir, name, "dist/index.js"),
      outfile: path.join(pluginsDir, name, "dist/plugin.bundle.js"),
    }));

  if (pluginEntries.length === 0) {
    console.log("bundle_plugins: no plugin dist/index.js files found, skipping.");
    return;
  }

  console.log(`bundle_plugins: bundling ${pluginEntries.length} plugin(s)...`);

  for (const { name, entry, outfile } of pluginEntries) {
    try {
      await esbuild.build({
        entryPoints: [entry],
        bundle: true,
        platform: "node",
        target: "node22",
        format: "cjs",
        outfile,

        // ── Packages that MUST remain external ──────────────────────────
        //
        // Shared with the server — plugins are loaded into the server
        // process at runtime via aki-plugin-manager.  If a plugin bundles
        // its own copy of yjs/valtio/etc., collaborative state breaks.
        external: [
          "@repo/base-plugin",
          "yjs",
          "lib0",
          "y-protocols",
          "valtio",
          "valtio-yjs",
          "@trpc/server",
          "zod",
          // mupdf uses top-level await (WASM loader) which esbuild cannot
          // emit in CJS format.  Keep it external; NFT will trace it.
          "mupdf",
        ],

        define: {
          "process.env.NODE_ENV": '"production"',
        },

        allowOverwrite: true,
        logLevel: "warning",
      });
      console.log(`  ✓ ${name}`);
    } catch (err) {
      console.error(`  ✗ ${name}: ${err.message}`);
      process.exit(1);
    }
  }

  console.log("bundle_plugins: done.");
}

main().catch((err) => {
  console.error("bundle_plugins: FAILED\n", err);
  process.exit(1);
});
