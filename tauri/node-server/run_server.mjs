import { spawn } from "child_process";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { getDataHome } from "platform-folders";

// Since we're running locally, we can just hard-code these values
const DATABASE_AUTHENTICATOR = "theopenpresenter_authenticator";
const DATABASE_AUTHENTICATOR_PASSWORD = "password_authenticator";
const DATABASE_OWNER = "theopenpresenter";
const DATABASE_OWNER_PASSWORD = "password_owner";
const DATABASE_VISITOR = "theopenpresenter_visitor";
const DATABASE_NAME = "theopenpresenter";

const PORT = 7949;

const runCommand = async (command, args, options) => {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, options);

    process.stdout.on("data", (data) => {
      console.log(`${data}`);
    });

    process.stderr.on("data", (data) => {
      console.log(`${data}`);
    });

    process.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });

    process.on("error", (err) => {
      reject(err);
    });
  });
};

const appDataFolderName = "TheOpenPresenter";

const uploadsPath = path.join(getDataHome(), appDataFolderName, "uploads");
const envPath = path.join(getDataHome(), appDataFolderName, ".env");

const nodeBinaryPath = path.resolve("./node");
const graphileWorkerJsPath = path.resolve(
  "node-server/theopenpresenter/node_modules/graphile-worker/dist/cli.js",
);

const killProcess = async (pg) => {
  await pg.stop();
  process.exit(1);
};

async function main() {
  const { EmbeddedPostgresManager } = await import(
    "./theopenpresenter/packages/embedded-postgres/dist/index.js"
  );
  const pg = new EmbeddedPostgresManager({
    appDataFolderName,
    projectRoot: resolve(import.meta.dirname, "./theopenpresenter"),
    // TODO: Handle multiple port
    port: PORT,
  });

  process.once("SIGINT", async () => {
    await pg.stop();

    process.kill(process.pid, "SIGINT");
    process.exit(1);
  });
  process.once("SIGTERM", () => killProcess(pg));
  process.once("SIGQUIT", () => killProcess(pg));
  process.once("exit", () => killProcess(pg));

  await pg.initialize();
  await pg.start();

  let envOverride = {};
  if (fs.existsSync(envPath)) {
    envOverride = dotenv.parse(fs.readFileSync(envPath));
  }

  const finalEnv = {
    NODE_ENV: "production",
    AUTO_LOGIN: "1",

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

    // PLUGINS
    ENABLED_PLUGINS:
      "lyrics-presenter,simple-image,google-slides,radio,audio-recorder,video-player,worship-pads,embed,timer",
    PLUGINS_PATH: "./plugins",
    // Debt: Make this easier for us to change
    PLUGIN_GOOGLE_SLIDES_CLIENT_ID:
      "69245303872-fo9ap9sv2a6a5oiim2aqsk1hnnrmkkdk.apps.googleusercontent.com",

    // ETC
    STATIC_FILES_PATH: "https://static.theopenpresenter.com",
    // Allows us to access through http
    DISABLE_HSTS: "1",
    // Allows access from any origin
    ALLOW_ANY_ORIGIN: "1",

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
      cwd: path.resolve("node-server/theopenpresenter/backend/worker/dist"),
      env: finalEnv,
    },
  );

  console.log("Starting Node Server...");
  await runCommand(
    nodeBinaryPath,
    [
      "-r",
      "@repo/config/extra",
      path.resolve("node-server/theopenpresenter/backend/server/dist/index.js"),
    ],
    {
      cwd: path.resolve("node-server/theopenpresenter"),
      env: finalEnv,
    },
  );
}

console.log("\n\nInitializing node server!");
main();
