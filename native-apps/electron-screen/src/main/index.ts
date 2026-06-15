import { BrowserWindow, app } from "electron";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

import { startClicker } from "./clicker";
import { storedRequireHostReachable, waitForHostAndShow } from "./host";
import { registerIPC } from "./ipc";
import { setupMonitorWatch } from "./monitor";
import { setupTray } from "./tray";
import {
  createMainWindow,
  createSettingsWindow,
  showScreen,
  showSettingsWindow,
} from "./windows";

// ---------------------------------------------------------------------------
// Prevent Chromium from throttling/suspending the renderer
// ---------------------------------------------------------------------------
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");

// Allow media to autoplay without a user gesture
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

// ---------------------------------------------------------------------------
// Hardware-accelerated video decode (Linux)
// ---------------------------------------------------------------------------

if (process.platform === "linux") {
  app.commandLine.appendSwitch("ignore-gpu-blocklist");
  app.commandLine.appendSwitch("enable-gpu-rasterization");
  app.commandLine.appendSwitch("enable-zero-copy");
  app.commandLine.appendSwitch(
    "enable-features",
    [
      "VaapiVideoDecoder", // enable VA-API hardware decode
      "VaapiVideoDecodeLinuxGL", // allow it under the GL backend (X11)
      "AcceleratedVideoDecodeLinuxGL",
      "VaapiOnNvidiaGPUs", // opt NVIDIA in (no-op on AMD/Intel)
      "PlatformHEVCDecoderSupport", // HEVC decode where the GPU supports it
    ].join(","),
  );
}

// ---------------------------------------------------------------------------
// Single-instance lock
// ---------------------------------------------------------------------------

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => showSettingsWindow());

  app.whenReady().then(() => {
    app.setAppUserModelId("com.theopenpresenter.electron-screen");

    createSettingsWindow();
    createMainWindow();
    registerIPC();
    setupTray();
    setupMonitorWatch();

    // Bridge a USB presentation clicker to the screen's PREV/NEXT (Linux only).
    startClicker();

    // Log Chromium's GPU feature status once it's accurate
    let loggedGpu = false;
    app.on("gpu-info-update", () => {
      if (loggedGpu) return;
      loggedGpu = true;
      console.log(
        "[GPU] feature status:",
        JSON.stringify(app.getGPUFeatureStatus()),
      );
    });

    // ---------------------------------------------------------------------------
    // Kiosk autostart: if the OS launched this app at login, show the screen.
    // On Linux we use an `--autostart` CLI flag in the XDG desktop file.
    // ---------------------------------------------------------------------------
    const isAutostartLaunch =
      process.argv.includes("--autostart") ||
      (process.platform !== "linux" && app.getLoginItemSettings().openAtLogin);

    if (isAutostartLaunch) {
      if (storedRequireHostReachable()) {
        waitForHostAndShow().catch(() => {});
      } else {
        showScreen();
      }
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createSettingsWindow();
      } else {
        showSettingsWindow();
      }
    });
  });

  // Keep the app alive in the system tray when all windows are closed
  app.on("window-all-closed", () => {
    // Intentionally do not quit — the tray keeps the app running
  });
}

// ---------------------------------------------------------------------------
// Helpers (exported for reuse if needed)
// ---------------------------------------------------------------------------

function xdgAutostartPath(): string {
  return join(homedir(), ".config", "autostart", "electron-screen.desktop");
}

export function isLinuxAutostartEnabled(): boolean {
  return process.platform === "linux" && existsSync(xdgAutostartPath());
}
