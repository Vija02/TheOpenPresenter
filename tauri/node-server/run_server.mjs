import { spawn } from "child_process";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Since we're running locally, we can just hard-code these values
const DATABASE_AUTHENTICATOR = "theopenpresenter_authenticator";
const DATABASE_AUTHENTICATOR_PASSWORD = "password_authenticator";
const DATABASE_OWNER = "theopenpresenter";
const DATABASE_OWNER_PASSWORD = "password_owner";
const DATABASE_VISITOR = "theopenpresenter_visitor";
const DATABASE_NAME = "theopenpresenter";

const PORT = 7949;

const childProcesses = new Set();

const runCommand = async (command, args, options) => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options);
    childProcesses.add(child);

    child.stdout.on("data", (data) => {
      console.log(`${data}`);
    });

    child.stderr.on("data", (data) => {
      console.log(`${data}`);
    });

    child.on("close", (code) => {
      childProcesses.delete(child);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });

    child.on("error", (err) => {
      childProcesses.delete(child);
      reject(err);
    });
  });
};

const appDataFolderName = "TheOpenPresenter";

const sidecarNodePath = path.resolve(
  import.meta.dirname,
  process.platform === "win32" ? "../node.exe" : "../node",
);
const nodeBinaryPath = fs.existsSync(sidecarNodePath)
  ? sidecarNodePath
  : fs.existsSync(process.execPath)
    ? process.execPath
    : "node";

// How long children get to exit on their own before we force them. Short,
// because stopping PostgreSQL is the part that actually matters.
const CHILD_EXIT_TIMEOUT_MS = 5000;

let shuttingDown = false;

const waitForChildren = async (timeoutMs) => {
  const deadline = Date.now() + timeoutMs;
  while (childProcesses.size > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
};

// Stops the worker/server children, then PostgreSQL.
//
// Idempotent: a signal, a stdin request and a child dying can all race, and we
// only ever want one teardown. Without the `pg.stop()` here, PostgreSQL keeps
// running after the app exits and holds its port, which breaks the next launch.
const shutdown = async (pg, exitCode = 0) => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  console.log("Shutting down...");

  for (const child of childProcesses) {
    try {
      child.kill("SIGTERM");
    } catch (err) {
      console.error("Failed to signal child process:", err);
    }
  }

  await waitForChildren(CHILD_EXIT_TIMEOUT_MS);

  for (const child of childProcesses) {
    try {
      child.kill("SIGKILL");
    } catch {
      // Already gone.
    }
  }

  try {
    await pg.stop();
  } catch (err) {
    console.error("Failed to stop PostgreSQL:", err);
  }

  process.exit(exitCode);
};

const installShutdownHandlers = (pg) => {
  process.once("SIGINT", () => shutdown(pg, 0));
  process.once("SIGTERM", () => shutdown(pg, 0));
  process.once("SIGQUIT", () => shutdown(pg, 0));

  process.stdin.on("data", (data) => {
    if (data.toString().includes("shutdown")) {
      shutdown(pg, 0);
    }
  });

  // Parent died and closed the pipe. Skipped on a TTY so an interactive run
  // isn't torn down by an empty stdin.
  if (!process.stdin.isTTY) {
    process.stdin.on("end", () => shutdown(pg, 0));
  }

  process.stdin.resume();
};

async function main() {
  const { EmbeddedPostgresManager, getAppDataPaths, getGraphilePaths } =
    await import("./theopenpresenter/packages/embedded-postgres/dist/index.js");

  const { uploadsPath, envPath } = getAppDataPaths(appDataFolderName);
  const { graphileWorkerJsPath } = getGraphilePaths(
    path.resolve(import.meta.dirname, "./theopenpresenter"),
  );

  const pg = new EmbeddedPostgresManager({
    appDataFolderName,
    projectRoot: path.resolve(import.meta.dirname, "./theopenpresenter"),
    migration: { nodeBinaryPath },
    // TODO: Handle multiple port
    port: PORT,
  });

  installShutdownHandlers(pg);

  await pg.initialize();
  await pg.start();

  let envOverride = {};
  if (fs.existsSync(envPath)) {
    envOverride = dotenv.parse(fs.readFileSync(envPath));
  }

  const finalEnv = {
    NODE_ENV: process.env.ENABLE_E2E_COMMANDS ? "test" : "production",
    LOG_LOCALLY: "1",
    // Disable auto login for test
    AUTO_LOGIN: process.env.ENABLE_E2E_COMMANDS ? "0" : "1",
    ENABLE_E2E_COMMANDS: process.env.ENABLE_E2E_COMMANDS ? "1" : "0",
    ...(process.env.PLUGIN_GOOGLE_SLIDES_UNOCONVERT_SERVER
      ? {
          PLUGIN_GOOGLE_SLIDES_UNOCONVERT_SERVER:
            process.env.PLUGIN_GOOGLE_SLIDES_UNOCONVERT_SERVER,
        }
      : {}),
    ENABLE_PROXY_DEVICE_ON_PRODUCTION: "1",

    // DB settings
    DATABASE_HOST: `localhost:${PORT}`,
    DATABASE_URL: `postgres://${DATABASE_OWNER}:${DATABASE_OWNER_PASSWORD}@localhost:${PORT}/${DATABASE_NAME}`,
    ROOT_DATABASE_URL: `postgres://postgres:password@localhost:${PORT}/postgres`,
    DATABASE_AUTHENTICATOR,
    DATABASE_AUTHENTICATOR_PASSWORD,
    DATABASE_OWNER,
    DATABASE_OWNER_PASSWORD,
    DATABASE_VISITOR,
    DATABASE_NAME,

    // CORE
    PORT: "5678",
    ROOT_URL: "http://localhost:5678",
    SECRET: "cookie_secret",
    GRAPHILE_TURBO: "1",

    // STORAGE
    STORAGE_TYPE: "file",
    STORAGE_PROXY: "local",
    UPLOADS_PATH: uploadsPath,

    // VIDEO
    VIDEO_TRANSCODE_PIPELINE: "mp4",

    // PLUGINS
    ENABLED_PLUGINS:
      "lyrics-presenter,slides,radio,audio-recorder,video-player,worship-pads,embed,timer,bible,screen-share",
    PLUGINS_PATH: "./plugins",
    // Debt: Make this easier for us to change
    PLUGIN_GOOGLE_SLIDES_CLIENT_ID:
      "69245303872-fo9ap9sv2a6a5oiim2aqsk1hnnrmkkdk.apps.googleusercontent.com",

    // ETC
    STATIC_FILES_PATH: "https://static.theopenpresenter.com",
    // Cloud base used to tunnel local media out to Office Online for PPT conversion
    MEDIA_PROXY_BASE_URL: "https://theopenpresenter.com",
    // Allows us to access through http
    DISABLE_HSTS: "1",
    // Allows access from any origin
    ALLOW_ANY_ORIGIN: "1",

    // Public base for outbound media fetch (e.g. Office Online), without
    // changing ROOT_URL. Only set in special setups (e.g. CI tunnel).
    ...(process.env.PUBLIC_ROOT_URL
      ? { PUBLIC_ROOT_URL: process.env.PUBLIC_ROOT_URL }
      : {}),

    ...envOverride,
  };

  console.log("Starting Worker...");
  runCommand(
    nodeBinaryPath,
    [
      "-r",
      "@repo/config/extra",
      graphileWorkerJsPath,
      "--crontab",
      "../crontab",
    ],
    {
      cwd: path.resolve(
        import.meta.dirname,
        "theopenpresenter/backend/worker/dist",
      ),
      env: finalEnv,
    },
  );

  console.log("Starting Node Server...");
  await runCommand(
    nodeBinaryPath,
    [
      "-r",
      "@repo/config/extra",
      path.resolve(
        import.meta.dirname,
        "theopenpresenter/backend/server/dist/index.js",
      ),
    ],
    {
      cwd: path.resolve(import.meta.dirname, "theopenpresenter"),
      env: finalEnv,
    },
  );
}

console.log("\n\nInitializing node server!");
main();
