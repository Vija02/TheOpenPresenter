import { BrowserWindow, app, screen } from "electron";

import { registerIPC } from "./ipc";
import { runtime } from "./runtime/client";
import { registerTicket } from "./runtime/remote";
import { chromiumDir } from "./settings/paths";
import {
  getSettings,
  resolveRootUrl,
  resolveRuntimeSource,
} from "./settings/store";
import { setupMenu } from "./shell/menu";
import { setupTray } from "./shell/tray";
import { isInstallingUpdate, setupUpdates } from "./shell/updates";
import {
  closeAllPresentWindows,
  closeLoadingWindow,
  getMainWindow,
  navigateToServer,
  openLoadingWindow,
  openOnboardingWindow,
  openUnreachableWindow,
  repositionPresentWindows,
  showAppWindow,
} from "./shell/windows";

/**
 * Windows taskbar grouping and the Linux desktop entry name.
 *
 * `.studio` rather than `.desktop`: the Tauri desktop-screen app already uses
 * `com.theopenpresenter.desktop`, and two apps sharing an ID collide over the
 * autostart entry and taskbar grouping. This app supersedes the Tauri Studio
 * app (`com.theopenpresenter`), which is being retired rather than upgraded,
 * so it takes a new ID rather than inheriting that one.
 */
export const APP_ID = "com.theopenpresenter.studio";

// Keep Electron's own state beside the runtime rather than in the platform
// default, so one install is one folder: deleting it takes the cloud session
// with the instance it belongs to. Must happen before anything touches a
// session or a path, hence up here rather than inside `whenReady`.
app.setPath("userData", chromiumDir());
app.setPath("sessionData", chromiumDir());

// Presentation output must not be throttled when the operator is working in
// another window, which is exactly when it matters most.
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

if (process.platform === "linux") {
  app.commandLine.appendSwitch("ignore-gpu-blocklist");
  app.commandLine.appendSwitch("enable-gpu-rasterization");
  app.commandLine.appendSwitch("enable-zero-copy");
  app.commandLine.appendSwitch(
    "enable-features",
    [
      "VaapiVideoDecoder",
      "VaapiVideoDecodeLinuxGL",
      "AcceleratedVideoDecodeLinuxGL",
      "VaapiOnNvidiaGPUs",
      "PlatformHEVCDecoderSupport",
    ].join(","),
  );
}

/**
 * One app per data directory. E2E runs opt out: each test drives its own
 * install in its own directory, and the lock is per user-data dir, so a
 * developer's running app would otherwise make every test quit on launch.
 */
const gotLock =
  process.env.TOP_E2E_NO_SINGLE_INSTANCE === "1" ||
  app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  /** True while startup is deciding which window to show. */
  let routing = true;

  app.on("second-instance", () => {
    const win = getMainWindow();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });

  app.whenReady().then(async () => {
    app.setAppUserModelId(APP_ID);

    // No main window yet: it is created when there is a server to show it.
    // Creating it here left a hidden window alive for the whole session, so
    // `window-all-closed` never fired and closing onboarding left the process
    // running with nothing on screen.
    registerIPC();
    setupMenu();
    setupTray();
    setupUpdates();
    forwardRuntimeEvents();

    screen.on("display-added", repositionPresentWindows);
    screen.on("display-removed", repositionPresentWindows);
    screen.on("display-metrics-changed", repositionPresentWindows);

    try {
      await startupRoute();
    } finally {
      routing = false;
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) void startupRoute();
    });
  });

  app.on("window-all-closed", () => {
    if (routing) return;
    if (process.platform !== "darwin") app.quit();
  });

  // The runtime owns PostgreSQL, which has to be shut down cleanly or it keeps
  // its port and breaks the next launch.
  let shuttingDown = false;
  app.on("before-quit", (event) => {
    // An update install shuts the runtime down itself, then calls
    // `quitAndInstall`. Replacing that with a plain `app.quit()` here would
    // restart the app on the old version.
    if (isInstallingUpdate()) return;
    if (shuttingDown || !runtime.isRunning) return;
    event.preventDefault();
    shuttingDown = true;
    closeAllPresentWindows();
    runtime
      .shutdown()
      .catch((err) => console.error("[main] runtime shutdown failed:", err))
      .finally(() => app.quit());
  });
}

/**
 * Decide what the user sees on launch. The runtime manager starts regardless
 * of mode: it is a small idle process.
 */
async function startupRoute(): Promise<void> {
  const settings = getSettings();

  // Nothing set up yet: onboarding owns the screen until it finishes.
  if (!settings.mode) {
    openOnboardingWindow();
    try {
      runtime.start({ source: resolveRuntimeSource() });
    } catch (err) {
      console.error("[main] runtime manager unavailable:", err);
    }
    return;
  }

  openLoadingWindow();

  try {
    runtime.start({ source: resolveRuntimeSource() });
  } catch (err) {
    // Not fatal: cloud and self-hosted mode do not need it.
    console.error("[main] runtime manager unavailable:", err);
  }

  if (settings.mode === "local") {
    try {
      if (settings.autoStartRuntime !== false) {
        const started = await runtime.startRuntime();
        if (started?.url) {
          if (settings.remoteAccess !== false) void resumeRemoteAccess();
          showAppWindow(started.url);
          return;
        }
      }
    } catch (err) {
      console.error("[main] failed to start the local runtime:", err);
    }

    // Open before closing, so the window count never reaches zero.
    openOnboardingWindow();
    closeLoadingWindow();
    return;
  }

  if (settings.rootUrl) {
    const { isLoggedIn, checkHost } = await import("./cloud/host");
    const rootUrl = resolveRootUrl(null);

    // Check if instance is up
    if (!(await checkHost(rootUrl))) {
      const { describeConnection } = await import("./settings/connection");
      // Open before closing the loading window. Closing first leaves zero
      // windows for an instant, which fires `window-all-closed` and quits the
      // app before the replacement appears.
      openUnreachableWindow(describeConnection(settings, null).label, rootUrl);
      closeLoadingWindow();
      return;
    }

    if (await isLoggedIn(rootUrl)) {
      showAppWindow(rootUrl);
      return;
    }
  }

  openOnboardingWindow();
  closeLoadingWindow();
}

/**
 * Bring remote access back up after a restart.
 */
async function resumeRemoteAccess(): Promise<void> {
  try {
    const status = await runtime.startRemote();
    if (status.enabled && status.ticket && status.node_id) {
      await registerTicket(status.ticket, status.node_id);
    }
  } catch (err) {
    console.error("[main] failed to resume remote access:", err);
  }
}

/** Relay manager events to every window showing the shell UI. */
function forwardRuntimeEvents(): void {
  const send = (channel: string, payload: unknown) => {
    // Broadcast rather than target the main window: during startup the only
    // window that exists is the loading one, and onboarding has its own too.
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send(channel, payload);
    }
  };

  runtime.on("progress", (payload) => send("runtime:progress", payload));
  runtime.on("warning", (payload) => send("runtime:warning", payload));
  runtime.on("ready", (payload) => send("runtime:ready", payload));
  // Nothing in the UI shows these. Kept on the channel for debugging.
  runtime.on("log", (payload) => send("runtime:log", payload));

  runtime.on("listening", (payload: { url: string }) => {
    send("runtime:listening", payload);
    // Deliberately no navigation: `runtime:start` hands the window over once
    // it has the final URL, and doing it here too raced that onto a stale URL.
  });

  runtime.on("runtime-exit", (payload) => send("runtime:exit", payload));
  runtime.on("manager-exit", (code) => send("runtime:manager-exit", { code }));
}
