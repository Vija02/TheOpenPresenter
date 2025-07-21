import { PgUuidv7Extension } from "./pgUuidv7.js";
import type { ExtensionConfig } from "../types/index.js";

export class ExtensionManager {
  private projectRoot: string;
  private config: ExtensionConfig;

  constructor(projectRoot: string, config: ExtensionConfig = {}) {
    this.projectRoot = projectRoot;
    this.config = config;
  }

  async installExtensions(): Promise<void> {
    const extensions: Promise<void>[] = [];

    if (this.config.installPgUuidv7 !== false) {
      console.log("Installing pg_uuidv7 extension...");
      const pgUuidv7 = new PgUuidv7Extension(
        this.projectRoot,
        this.config.extensionSourcePath
      );
      extensions.push(pgUuidv7.install());
    }

    if (extensions.length > 0) {
      await Promise.all(extensions);
      console.log("All extensions installed successfully");
    } else {
      console.log("No extensions to install");
    }
  }
}

export { PgUuidv7Extension };