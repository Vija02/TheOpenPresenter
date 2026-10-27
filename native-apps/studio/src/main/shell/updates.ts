import { BrowserWindow, app } from "electron";
import type { UpdateInfo } from "electron-updater";
import pkg from "electron-updater";

import { type ProgressEvent, runtime } from "../runtime/client";
import { DEFAULT_CHANNEL, getSettings } from "../settings/store";
import { logShell, shellLogger } from "./log";
import { closeUpdateWindow, openUpdateWindow } from "./windows";

const { autoUpdater } = pkg;

/**
 * Keeping the app up to date: the electron app itself, and in local mode the
 * runtime it serves. Both are offered together in one popup at launch.
 */

export type UpdateState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available"; version: string }
  | { status: "downloading"; version: string; percent: number }
  | { status: "ready"; version: string }
  | { status: "unsupported"; reason: string }
  | { status: "error"; message: string; version?: string };

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
    setState({
      status: "error",
      message: err?.message ?? String(err),
      ...(state.status === "downloading" && { version: state.version }),
    });
  });
}

export async function checkAtLaunch(): Promise<void> {
  const [appUpdate, runtimeUpdate] = await Promise.all([
    checkForUpdates(),
    checkForRuntimeUpdate(),
  ]);
  if (
    appUpdate.status === "available" ||
    runtimeUpdate.status === "available"
  ) {
    openUpdateWindow();
  }
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

/** Download everything on offer, app and runtime side by side. */
export async function downloadUpdates(): Promise<void> {
  await Promise.all([downloadAppUpdate(), downloadRuntimeUpdate()]);
}

async function downloadAppUpdate(): Promise<void> {
  if (!offered) return;
  if (state.status !== "available" && state.status !== "error") return;
  setState({ status: "downloading", version: offered, percent: 0 });
  try {
    await autoUpdater.downloadUpdate();
  } catch (err) {
    // Usually already reported through the `error` event, but not always.
    const current = updateState();
    if (current.status === "downloading") {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : String(err),
        version: current.version,
      });
    }
  }
}

/**
 * Restart into whatever has been downloaded. A new app goes through the
 * installer; a new runtime alone relaunches the app, so every window comes
 * back against the new server rather than reconnecting to it.
 */
export async function installUpdate(): Promise<void> {
  const appReady = state.status === "ready";
  const runtimeReady = runtimeState.status === "ready";
  if (!appReady && !runtimeReady) return;

  if (appReady) {
    await shutdownForInstall();
    autoUpdater.quitAndInstall();
    return;
  }

  closeUpdateWindow();
  if (runtimeState.status === "ready" && runtimeState.needsRestart) {
    relaunchApp();
    return;
  }
  setRuntimeState({ status: "none" });
}

/** Quit and start again. `before-quit` shuts the runtime down cleanly. */
export function relaunchApp(): void {
  app.relaunch();
  app.quit();
}

/** How the quit guard is bypassed for an install. */
let installing = false;

export function isInstallingUpdate(): boolean {
  return installing;
}

async function shutdownForInstall(): Promise<void> {
  installing = true;
  if (runtime.isRunning) {
    await runtime
      .shutdown()
      .catch((err) =>
        logShell("error", "[updates] runtime shutdown failed:", err),
      );
  }
}

// -- Runtime ------------------------------------------------------------------

export type RuntimeUpdateState =
  | { status: "none" }
  | { status: "checking" }
  | { status: "available"; current: string | null; version: string }
  | {
      status: "downloading";
      version: string;
      progress: ProgressEvent | null;
    }
  /** `needsRestart`: the server is still running the old version. */
  | { status: "ready"; version: string; needsRestart: boolean }
  | { status: "error"; version: string; message: string };

let runtimeState: RuntimeUpdateState = { status: "none" };

export function runtimeUpdateState(): RuntimeUpdateState {
  return runtimeState;
}

function setRuntimeState(next: RuntimeUpdateState): void {
  runtimeState = next;
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send("update:runtime", next);
  }
}

function channel(): string {
  return getSettings().channel ?? DEFAULT_CHANNEL;
}

/** Only local mode runs a runtime; elsewhere there is nothing to update. */
export async function checkForRuntimeUpdate(): Promise<RuntimeUpdateState> {
  if (getSettings().mode !== "local" || !runtime.isRunning) {
    return runtimeState;
  }
  // Mid-download or waiting on a restart: a fresh check would lose that.
  if (runtimeState.status === "downloading" || runtimeState.status === "ready")
    return runtimeState;

  setRuntimeState({ status: "checking" });
  try {
    const [found, status] = await Promise.all([
      runtime.check(channel()),
      runtime.status(),
    ]);
    setRuntimeState(
      found.version === status.current
        ? { status: "none" }
        : {
            status: "available",
            current: status.current,
            version: found.version,
          },
    );
  } catch (err) {
    // Offline, most likely. Not worth a popup.
    logShell("warn", "[updates] runtime check failed:", err);
    setRuntimeState({ status: "none" });
  }
  return runtimeState;
}

async function downloadRuntimeUpdate(): Promise<void> {
  if (runtimeState.status !== "available" && runtimeState.status !== "error")
    return;
  const version = runtimeState.version;
  setRuntimeState({ status: "downloading", version, progress: null });

  const onProgress = (progress: ProgressEvent) => {
    if (runtimeState.status === "downloading") {
      setRuntimeState({ status: "downloading", version, progress });
    }
  };
  runtime.on("progress", onProgress);
  try {
    // Activated straight away: a running server keeps its version until it
    // is restarted, and the manager brings a crashed one back on that same
    // version rather than the new one.
    const status = await runtime.status();
    const result = await runtime.ensure(channel(), true);
    setRuntimeState({
      status: "ready",
      version: result.version,
      needsRestart: status.running,
    });
  } catch (err) {
    logShell("error", "[updates] runtime download failed:", err);
    setRuntimeState({
      status: "error",
      version,
      message: err instanceof Error ? err.message : String(err),
    });
  } finally {
    runtime.off("progress", onProgress);
  }
}
