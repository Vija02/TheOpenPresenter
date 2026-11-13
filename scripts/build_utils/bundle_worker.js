/**
 * Bundles each graphile-worker task file (backend/worker/dist/tasks/*.js)
 * with its pure-JS dependencies into self-contained files using esbuild.
 *
 * graphile-worker loads tasks by scanning the tasks/ directory and require()-ing
 * each file by name, so output file names are preserved.  After bundling, the
 * task files no longer need most of their node_modules entries.
 *
 * Run: node scripts/build_utils/bundle_worker.js
 * (called automatically by backend/worker's build script after pkgroll)
 */

const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs");

const projectRoot = path.resolve(__dirname, "../..");

async function main() {
  const tasksDir = path.join(projectRoot, "backend/worker/dist/tasks");

  if (!fs.existsSync(tasksDir)) {
    console.log("bundle_worker: tasks/ directory not found, skipping.");
    return;
  }

  const taskFiles = fs
    .readdirSync(tasksDir)
    .filter((f) => f.endsWith(".js") && !f.endsWith(".bundle.js"))
    .map((f) => path.join(tasksDir, f));

  if (taskFiles.length === 0) {
    console.log("bundle_worker: no task files found, skipping.");
    return;
  }

  console.log(`bundle_worker: bundling ${taskFiles.length} task(s)...`);

  await esbuild.build({
    entryPoints: taskFiles,
    bundle: true,
    platform: "node",
    target: "node22",
    format: "cjs",
    // Output back to the same tasks/ directory with the same file names.
    // graphile-worker discovers tasks by file name, so names must not change.
    outdir: tasksDir,
    entryNames: "[name]",

    external: [
      // Binary packages that ship OS executables
      "ffmpeg-static",

      // graphile-worker is the task RUNNER — tasks run inside it,
      // so it must not be bundled into the tasks themselves.
      "graphile-worker",
    ],

    define: {
      "process.env.NODE_ENV": '"production"',
    },

    allowOverwrite: true,
    logLevel: "info",
  });

  console.log("bundle_worker: done.");
}

main().catch((err) => {
  console.error("bundle_worker: FAILED\n", err);
  process.exit(1);
});
