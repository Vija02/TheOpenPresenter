import { join, resolve } from "path";
import { userDataDir } from "platformdirs";

export const getAppDataPaths = (appDataFolderName: string) => {
  const appDataRoot = userDataDir(appDataFolderName, false, undefined, true);

  return {
    appDataRoot,
    uploadsPath: join(appDataRoot, "uploads"),
    databaseDir: join(appDataRoot, "db"),
    envPath: join(appDataRoot, ".env"),
  };
};

export const getGraphilePaths = (projectRoot: string) => {
  return {
    graphileMigrateJsPath: resolve(
      projectRoot,
      "node_modules/graphile-migrate/dist/cli.js",
    ),
    graphileWorkerJsPath: resolve(
      projectRoot,
      "node_modules/graphile-worker/dist/cli.js",
    ),
  };
};

export const getEmbeddedPostgresPaths = (projectRoot: string) => {
  const platform = process.platform;
  const arch = process.arch;
  const rustStyleTarget = `${platform === "win32" ? "windows" : platform}-${arch}`;

  const baseNativePath = resolve(
    projectRoot,
    `node_modules/@embedded-postgres/${rustStyleTarget}/native`,
  );

  if (process.platform === "win32") {
    return {
      extensionDir: join(baseNativePath, "share/extension/"),
      libDir: join(baseNativePath, "lib/"),
    };
  } else {
    return {
      extensionDir: join(baseNativePath, "share/postgresql/extension/"),
      libDir: join(baseNativePath, "lib/postgresql/"),
    };
  }
};
