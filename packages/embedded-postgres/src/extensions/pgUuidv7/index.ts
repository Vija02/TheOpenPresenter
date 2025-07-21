import { copyFileSync, existsSync, mkdirSync } from "fs";
import { join, resolve } from "path";

import { getEmbeddedPostgresPaths } from "../../utils/paths.js";

const precompiledBinary = [
  {
    platform: "linux",
    arch: "x64",
    binaryPath: "linux_x86_64.so",
  },
  {
    platform: "win32",
    arch: "x64",
    binaryPath: "win32_x86_64.dll",
  },
];

// Debt: We need to change this manually when we upgrade our PG version
const PG_VERSION = "17";

export class PgUuidv7Extension {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  async install(): Promise<void> {
    try {
      console.log("Installing pg_uuidv7 extension...");

      const { extensionDir, libDir } = getEmbeddedPostgresPaths(
        this.projectRoot,
      );
      const extensionBinaryPath = resolve(
        this.projectRoot,
        "./packages/embedded-postgres/src/extensions/pgUuidv7",
      );

      // Check if already installed
      if (!existsSync(join(extensionDir, "pg_uuidv7.control"))) {
        console.log("Already installed. Skipping...");
        return;
      }

      // Ensure directories exist
      mkdirSync(extensionDir, { recursive: true });
      mkdirSync(libDir, { recursive: true });

      // Copy the binary
      const platformConfig = precompiledBinary.find(
        (config) =>
          config.platform === process.platform && config.arch === process.arch,
      );

      if (!platformConfig) {
        throw new Error(
          `Unsupported platform or architecture: ${process.platform}, ${process.arch}`,
        );
      }

      const sourceBinary = join(
        extensionBinaryPath,
        `pg${PG_VERSION}`,
        platformConfig.binaryPath,
      );
      const targetBinary = join(
        libDir,
        process.platform === "win32" ? "pg_uuidv7.dll" : "pg_uuidv7.so",
      );

      copyFileSync(sourceBinary, targetBinary);

      // Then we can copy SQL and control files
      copyFileSync(
        join(extensionBinaryPath, "pg_uuidv7--1.6.sql"),
        join(extensionDir, "pg_uuidv7--1.6.sql"),
      );

      copyFileSync(
        join(extensionBinaryPath, "pg_uuidv7.control"),
        join(extensionDir, "pg_uuidv7.control"),
      );

      console.log("PG extension installation completed successfully");
    } catch (error) {
      console.error("PG extension installation failed:", error);
      throw error;
    }
  }
}
