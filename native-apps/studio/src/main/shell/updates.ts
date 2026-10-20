import { BrowserWindow, app } from "electron";
import type { UpdateInfo } from "electron-updater";
import pkg from "electron-updater";

import { logShell, shellLogger } from "./log";
import { openUpdateWindow } from "./windows";

const { autoUpdater } = pkg;

/** Keeping the electron app itself up to date. */

export type UpdateState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available"; version: string }
  | { status: "downloading"; version: string; percent: number }
  | { status: "ready"; version: string }
  | { status: "unsupported"; reason: string }
  | { status: "error"; message: string };

let state: UpdateState = { status: "idle" };
/** The version on offer, kept so a failed download can be retried. */
let offered: string | null = null;

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
      reason: "Unable to update this installation automatically.",
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

  // Nothing happens without being asked: the download competes with the
  // service for bandwidth, and swapping the app out from under someone
  // mid-service is worse. A downloaded update still applies on the next quit.
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = shellLogger;

  autoUpdater.on("checking-for-update", () => setState({ status: "checking" }));
  autoUpdater.on("update-not-available", () => setState({ status: "idle" }));
  autoUpdater.on("update-available", (info: UpdateInfo) => {
    offered = info.version;
    setState({ status: "available", version: info.version });
  });
  autoUpdater.on("download-progress", (progress) =>
    setState({
      status: "downloading",
      version: offered ?? "",
      percent: Math.round(progress.percent),
    }),
  );
  autoUpdater.on("update-downloaded", (info: UpdateInfo) =>
    setState({ status: "ready", version: info.version }),
  );
  autoUpdater.on("error", (err) => {
    logShell("error", "[updates]", err);
    // Being offline is the common case here, not a fault worth shouting about.
    setState({ status: "error", message: err?.message ?? String(err) });
  });

  void checkForUpdates().then((result) => {
    if (result.status === "available") openUpdateWindow();
  });
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

export async function downloadUpdate(): Promise<void> {
  if (!offered) return;
  if (state.status !== "available" && state.status !== "error") return;
  setState({ status: "downloading", version: offered, percent: 0 });
  try {
    await autoUpdater.downloadUpdate();
  } catch (err) {
    // Usually already reported through the `error` event, but not always.
    if (updateState().status === "downloading") {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
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
      .catch((err) =>
        logShell("error", "[updates] runtime shutdown failed:", err),
      );
  }
}
