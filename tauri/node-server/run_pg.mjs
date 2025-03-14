import { spawn } from "child_process";
import dotenv from "dotenv";
import EmbeddedPostgres from "embedded-postgres";
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

const databaseDir = path.join(getDataHome(), "TheOpenPresenter", "db");
const envPath = path.join(getDataHome(), "TheOpenPresenter", ".env");
const nodeBinaryPath = path.resolve("./node");
const graphileMigrateJsPath = path.resolve(
  "node-server/theopenpresenter/node_modules/graphile-migrate/dist/cli.js",
);
const uploadsPath = path.join(getDataHome(), "TheOpenPresenter", "uploads");

async function main() {
  const pg = new EmbeddedPostgres({
    databaseDir,
    user: "postgres",
    password: "password",
    // TODO: Handle multiple port
    port: PORT,
    persistent: true,
  });

  process.once("SIGINT", async () => {
    await pg.stop();

    process.kill(process.pid, "SIGINT");
    process.exit(1);
  });

  process.once("SIGTERM", async () => {
    await pg.stop();
    process.exit(1);
  });
  process.once("SIGQUIT", async () => {
    await pg.stop();
    process.exit(1);
  });

  process.once("exit", async () => {
    await pg.stop();
    process.exit(1);
  });

  if (!fs.existsSync(databaseDir)) {
    console.log("Database not initialized, initializing now...");
    let client;
    try {
      await pg.initialise();
      await pg.start();
      console.log("Database Initialized & Started. Running setup now...");

      // Setup database
      client = pg.getPgClient();
      await client.connect();

      // IMPORTANT: This should match with the setup_db.js script.
      await client.query(
        `CREATE ROLE ${DATABASE_OWNER} WITH LOGIN PASSWORD '${DATABASE_OWNER_PASSWORD}' SUPERUSER;`,
      );
      await client.query(
        `CREATE ROLE ${DATABASE_AUTHENTICATOR} WITH LOGIN PASSWORD '${DATABASE_AUTHENTICATOR_PASSWORD}' NOINHERIT;`,
      );
      await client.query(`CREATE ROLE ${DATABASE_VISITOR};`);
      await client.query(
        `GRANT ${DATABASE_VISITOR} TO ${DATABASE_AUTHENTICATOR};`,
      );

      console.log("Database roles successfully added");

      console.log("Installing schema to DB now...");
      await runCommand(
        nodeBinaryPath,
        [graphileMigrateJsPath, "-c", "node-server/.gmrc", "reset", "--erase"],
        {
          env: {
            DATABASE_URL: `postgres://${DATABASE_OWNER}:${DATABASE_OWNER_PASSWORD}@localhost:${PORT}/${DATABASE_NAME}`,
            ROOT_DATABASE_URL: `postgres://postgres:password@localhost:${PORT}/postgres`,
            DATABASE_AUTHENTICATOR,
            DATABASE_VISITOR,
          },
        },
      );
      console.log("DB schema installed. We're done!");
    } catch (e) {
      console.error("Failed to initialize PG database", e);
      throw e;
    } finally {
      await client.end();
    }
    console.log("Database initialization done!");
  } else {
    console.log("Starting Postgres...");
    await pg.start();
    console.log("Postgres started!");
  }

  // TODO: Migrate
  // await runCommand(
  //   nodeBinaryPath,
  //   [graphileMigrateJsPath, "-c", "node-server/.gmrc", "reset", "--erase"],
  //   {
  //     env: {
  //       DATABASE_URL: `postgres://${DATABASE_OWNER}:${DATABASE_OWNER_PASSWORD}@localhost:${PORT}/${DATABASE_NAME}`,
  //       ROOT_DATABASE_URL: `postgres://postgres:password@localhost:${PORT}/postgres`,
  //       DATABASE_AUTHENTICATOR,
  //       DATABASE_VISITOR,
  //     },
  //   },
  // );

  let envOverride = {};
  if (fs.existsSync(envPath)) {
    envOverride = dotenv.parse(fs.readFileSync(envPath));
  }

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
      env: {
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
          "lyrics-presenter,simple-image,google-slides,radio,audio-recorder,video-player,worship-pads,embed",
        PLUGINS_PATH: "./plugins",
        // Debt: Make this easier for us to change
        PLUGIN_GOOGLE_SLIDES_CLIENT_ID:
          "69245303872-fo9ap9sv2a6a5oiim2aqsk1hnnrmkkdk.apps.googleusercontent.com",

        // ETC
        STATIC_FILES_PATH: "https://static.theopenpresenter.com",

        ...envOverride,
      },
    },
  );
}

console.log("Running JS script");
main();
