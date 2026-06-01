import { copyFileSync, existsSync } from "fs";
import { resolve } from "path";

import { runSync } from "./lib/run.js";

const projectRoot = resolve(import.meta.dirname, "../");

async function runDb(EmbeddedPostgresManager) {
  const pgManager = new EmbeddedPostgresManager({
    appDataFolderName: "LocalEmbeddedDB",
    projectRoot: resolve(import.meta.dirname, "../"),
  });

  try {
    await pgManager.initialize();
    await pgManager.start();

    console.log("✅ PostgreSQL is running!");
    console.log("🔗 Connection string:", pgManager.getConnectionString());
    console.log("📊 Connection info:", pgManager.getConnectionInfo());

    const urls = pgManager.getDatabaseUrls();
    console.log("🌐 Database URLs:", urls);
    console.log(
      "ℹ️  Make sure your .env is setup with the correct credentials",
    );
  } catch (error) {
    console.error("❌ Failed to run DB:", error);
    process.exit(1);
  }
}

async function runLocalDev() {
  // Setup dev env if not yet
  const envPath = resolve(projectRoot, ".env");
  if (!existsSync(envPath)) {
    console.log("⚙️ Setting up a development .env");
    copyFileSync(resolve(projectRoot, ".env.dev"), envPath);
  }

  try {
    const { EmbeddedPostgresManager } = await import("@repo/embedded-postgres");
    await runDb(EmbeddedPostgresManager);
  } catch (e) {
    if (e.code === "ERR_MODULE_NOT_FOUND") {
      console.log("📦 Embedded Postgres is not built. Building now...");

      runSync("yarn", ["workspace", "@repo/embedded-postgres", "build"]);

      console.log("📦 Built!");

      const { EmbeddedPostgresManager } = await import(
        "@repo/embedded-postgres"
      );
      await runDb(EmbeddedPostgresManager);
    } else {
      throw e;
    }
  }
}

runLocalDev().catch((err) => {
  console.error("local-dev failed:", err);
  process.exit(1);
});
