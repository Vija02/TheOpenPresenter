import { shell } from "electron";

import { runtime } from "../runtime/client";

export async function openDataFolder(): Promise<void> {
  const paths = await runtime.paths();
  const error = await shell.openPath(paths.root);
  if (error) {
    throw new Error(`Could not open ${paths.root}: ${error}`);
  }
}
