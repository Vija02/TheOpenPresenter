import { homedir } from "os";
import { join } from "path";

/**
 * Electron data stored inside the runtime's root folder under /electron
 */

export const APP_DATA_FOLDER = "TheOpenPresenter";

/** The platform data directory, matching Rust's `BaseDirs::data_dir()`. */
export function platformDataDir(): string {
  const home = homedir();
  switch (process.platform) {
    case "win32":
      // `directories` uses roaming AppData on Windows.
      return process.env.APPDATA || join(home, "AppData", "Roaming");
    case "darwin":
      return join(home, "Library", "Application Support");
    default:
      return process.env.XDG_DATA_HOME || join(home, ".local", "share");
  }
}

/** The runtime root: `TOP_RUNTIME_ROOT`, or the platform default. */
export function runtimeRoot(): string {
  const explicit = process.env.TOP_RUNTIME_ROOT?.trim();
  if (explicit) return explicit;
  return join(platformDataDir(), APP_DATA_FOLDER);
}

export function shellDir(): string {
  return join(runtimeRoot(), "electron");
}

/**
 * Where Electron keeps its own state: the cookie jar, caches, GPU blobs.
 *
 * Its own subfolder rather than `shellDir()` directly, because Chromium fills
 * it with a dozen directories of its own and our settings file would be lost
 * among them. Under the runtime root so that one install is one folder: the
 * cloud session and the instance it belongs to are deleted together.
 */
export function chromiumDir(): string {
  return join(shellDir(), "chromium");
}
