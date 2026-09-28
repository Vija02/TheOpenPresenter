/**
 * Bundles the server's compiled JS (from tsup) with all its pure-JS dependencies
 * into a single file using esbuild. This dramatically reduces the number of files
 * that need to be shipped with the Tauri desktop app (from ~100k+ node_modules
 * files to just a handful of native addon packages).
 *
 * Run: node scripts/build_utils/bundle_server.js
 * (called automatically by backend/server's build script after tsup)
 */

const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs");

const projectRoot = path.resolve(__dirname, "../..");

async function main() {
  const entryPoint = path.join(
    projectRoot,
    "backend/server/dist/index.js",
  );

  if (!fs.existsSync(entryPoint)) {
    console.error(
      `bundle_server: entry point not found: ${entryPoint}\n` +
        `Run 'yarn server build' (tsup step) first.`,
    );
    process.exit(1);
  }

  console.log("bundle_server: bundling server with esbuild...");

  const result = await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    platform: "node",
    // Target the Node.js version bundled inside the Tauri app.
    // Adjust if the embedded Node version changes.
    target: "node22",
    format: "cjs",
    outfile: path.join(projectRoot, "backend/server/dist/server.bundle.js"),

    // ── Packages that MUST remain external ───────────────────────────────
    //
    // 1. Native / binary packages — esbuild cannot inline .node files or
    //    OS binaries; they must exist on disk at runtime.
    //
    // 2. Modules shared with dynamically-loaded plugins — plugins are
    //    loaded at runtime via aki-plugin-manager (aki.load). If both the
    //    server bundle and a plugin bundle their own copy of e.g. `yjs`,
    //    collaborative documents would break because the two Y.Doc classes
    //    would be different objects.  Keeping these external ensures every
    //    module in the process uses the single copy from node_modules.
    //
    // 3. graphile-worker — used by the server to *enqueue* jobs, but the
    //    actual worker process is a separate process using the graphile-
    //    worker CLI.  Bundling it could break its internal __dirname-based
    //    file lookups for SQL migration files.
    // ─────────────────────────────────────────────────────────────────────
    external: [
      // (1) Native / binary
      "sharp",
      "ffmpeg-static",
      "embedded-postgres",
      "@embedded-postgres/*",
      // lightningcss ships platform-specific .node files and a WASM fallback;
      // it must not be bundled.
      "lightningcss",

      // (2) Build tools / dev-server libs — see the plugin below which stubs
      // them out entirely rather than externalising them, so they don't appear
      // in the bundle at all and NFT won't trace them.
      // (Listed here as a reminder; they are handled by the plugin, not by
      // this external array.)
      // "vite", "astro", "esbuild" → handled by productionStubPlugin below

      // (2) Shared with plugins
      "@repo/base-plugin", // Plugin interface — plugins extend these classes
      "yjs", // Collaborative document state
      "lib0", // yjs internal dependency
      "y-protocols", // yjs protocol layer
      "valtio", // Reactive state shared between server ↔ plugins
      "valtio-yjs", // valtio ↔ yjs bridge
      "@trpc/server", // Plugins register tRPC routers into the server
      "zod", // Schema types used across plugin ↔ server tRPC boundaries

      // (3) Complex internals
      "graphile-worker",
    ],

    // Treat this as a production build.  This lets esbuild dead-code-
    // eliminate dev-only branches (e.g. vite-express's dev server setup)
    // so vite is NOT pulled into the bundle.
    define: {
      "process.env.NODE_ENV": '"production"',
    },

    // Stub out packages that are only imported inside dev-mode branches.
    // Even with define:NODE_ENV=production, esbuild keeps function definitions
    // around (it only eliminates the call sites), so dynamic imports inside
    // functions like `installAstroDev` still appear in the bundle.
    // Replacing those imports with empty objects here ensures they are fully
    // absent from both the bundle and the NFT file-trace results.
    plugins: [
      {
        name: "production-stubs",
        setup(build) {
          const devOnlyPackages = /^(astro|vite|esbuild)$/;
          build.onResolve({ filter: devOnlyPackages }, (args) => ({
            namespace: "production-stub",
            path: args.path,
          }));
          build.onLoad(
            { filter: /.*/, namespace: "production-stub" },
            () => ({ contents: "module.exports = {};", loader: "js" }),
          );
        },
      },
    ],

    allowOverwrite: true,
    metafile: true,
    logLevel: "info",
  });

  // Write the metafile so you can inspect what got bundled vs external:
  //   npx esbuild-visualizer --metadata backend/server/dist/server.bundle.meta.json
  if (result.metafile) {
    fs.writeFileSync(
      path.join(
        projectRoot,
        "backend/server/dist/server.bundle.meta.json",
      ),
      JSON.stringify(result.metafile),
    );
  }

  const stat = fs.statSync(
    path.join(projectRoot, "backend/server/dist/server.bundle.js"),
  );
  console.log(
    `bundle_server: done — ${(stat.size / 1024 / 1024).toFixed(1)} MB`,
  );
}

main().catch((err) => {
  console.error("bundle_server: FAILED\n", err);
  process.exit(1);
});
