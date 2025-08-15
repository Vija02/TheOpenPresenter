import { resolve } from "path";

const projectRoot = resolve(import.meta.dirname, "../../../");

async function installPgExtensions() {
  const { ExtensionManager } = await import("@repo/embedded-postgres");

  try {
    await new ExtensionManager(projectRoot).installExtensions();
  } catch (e) {
    if (e.code === "ERR_MODULE_NOT_FOUND") {
      console.log("📦 Embedded Postgres is not built. Building now...");

      runSync("yarn", ["workspace", "@repo/embedded-postgres", "build"]);

      console.log("📦 Built!");

      const { ExtensionManager } = await import("@repo/embedded-postgres");
      await new ExtensionManager(projectRoot).installExtensions();
    } else {
      throw e;
    }
  }
}

installPgExtensions();
