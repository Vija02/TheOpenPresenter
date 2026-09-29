import { BrowserWindow, app } from "electron";
import type { UpdateInfo } from "electron-updater";
import pkg from "electron-updater";

const { autoUpdater } = pkg;

/** Keeping the electron app itself up to date. */

export type UpdateState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "downloading"; percent: number }
  | { status: "ready"; version: string }
  | { status: "unsupported"; reason: string }
  | { status: "error"; message: string };

let state: UpdateState = { status: "idle" };

export function updateState(): UpdateState {
  return state;
}

function broadcast(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send("update:state", state);
  }
}

function setState(next: UpdateState): void {
  state = next;
  broadcast();
}

/** Whether this build can replace itself. */
export function updateSupport(): { supported: boolean; reason: string } {
  if (!app.isPackaged) {
    return {
      supported: false,
      reason: "Updates only apply to an installed app.",
    };
  }
  if (process.platform === "linux" && !process.env.APPIMAGE) {
    return {
      supported: false,
      reason:
        "This copy was installed by your package manager. Update it the same way.",
    };
  }
  return { supported: true, reason: "" };
}

export function setupUpdates(): void {
  const support = updateSupport();
  if (!support.supported) {
    state = { status: "unsupported", reason: support.reason };
    return;
  }

  // Downloading is fine unattended; swapping the app out from under someone
  // mid-service is not, so installing always waits to be asked.
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => setState({ status: "checking" }));
  autoUpdater.on("update-not-available", () => setState({ status: "idle" }));
  autoUpdater.on("download-progress", (progress) =>
    setState({
      status: "downloading",
      percent: Math.round(progress.percent),
    }),
  );
  autoUpdater.on("update-downloaded", (info: UpdateInfo) =>
    setState({ status: "ready", version: info.version }),
  );
  autoUpdater.on("error", (err) =>
    // Being offline is the common case here, not a fault worth shouting about.
    setState({ status: "error", message: err?.message ?? String(err) }),
  );

  void checkForUpdates();
}

export async function checkForUpdates(): Promise<UpdateState> {
  if (!updateSupport().supported) return state;
  try {
    await autoUpdater.checkForUpdates();
  } catch (err) {
    setState({
      status: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
  return state;
}

/** Restart into the downloaded version. Only valid once one is ready. */
export function installUpdate(): void {
  if (state.status !== "ready") return;
  // `quitAndInstall` fires `before-quit`, where the runtime shutdown guard
  // calls `preventDefault()` and then `app.quit()`. That plain quit would
  // lose the install, so the shutdown is done here first and the guard is
  // told to stand aside.
  void shutdownForInstall().then(() => autoUpdater.quitAndInstall());
}

/** How the quit guard is bypassed for an install. */
let installing = false;

export function isInstallingUpdate(): boolean {
  return installing;
}

async function shutdownForInstall(): Promise<void> {
  installing = true;
  const { runtime } = await import("../runtime/client");
  if (runtime.isRunning) {
    await runtime
      .shutdown()
      .catch((err) => console.error("[updates] runtime shutdown failed:", err));
  }
}
