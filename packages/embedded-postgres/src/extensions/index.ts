import { PgUuidv7Extension } from "./pgUuidv7/index.js";

export class ExtensionManager {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  async installExtensions(): Promise<void> {
    const extensions: Promise<void>[] = [];

    console.log("Installing pg_uuidv7 extension...");
    const pgUuidv7 = new PgUuidv7Extension(this.projectRoot);
    extensions.push(pgUuidv7.install());

    if (extensions.length > 0) {
      await Promise.all(extensions);
      console.log("All extensions installed successfully");
    } else {
      console.log("No extensions to install");
    }
  }
}

export { PgUuidv7Extension };
