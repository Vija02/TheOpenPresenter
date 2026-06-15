import { spawnSync } from "child_process";
import { BrowserWindow, app, globalShortcut, screen } from "electron";
import { join } from "path";

import { store } from "./store";

const PRELOAD_PATH = join(__dirname, "../preload/index.js");
const RENDERER_URL = process.env["ELECTRON_RENDERER_URL"];
const RENDERER_HTML = join(__dirname, "../renderer/index.html");

export const ICON_PATH = app.isPackaged
  ? join(process.resourcesPath, "icon.png")
  : join(__dirname, "../../packaging/icon.png");

function loadWindow(
  win: BrowserWindow,
  queryWindow: "settings" | "main",
): void {
  if (RENDERER_URL) {
    win.loadURL(`${RENDERER_URL}?window=${queryWindow}`);
  } else {
    win.loadFile(RENDERER_HTML, { query: { window: queryWindow } });
  }
}

let settingsWin: BrowserWindow | null = null;
let mainWin: BrowserWindow | null = null;

export function getSettingsWin(): BrowserWindow | null {
  return settingsWin;
}

export function getMainWin(): BrowserWindow | null {
  return mainWin;
}

// ---------------------------------------------------------------------------
// Audio mute
//
// The renderer keeps running while the screen window is hidden, so audio would
// keep playing. We mute whenever the window is hidden, and otherwise honour the
// user's explicit mute choice: effectiveMute = userMuted || !visible.
// ---------------------------------------------------------------------------

let userMuted = false;

function applyAudioMute(): void {
  if (!mainWin || mainWin.isDestroyed()) return;
  const hidden = !mainWin.isVisible();
  mainWin.webContents.setAudioMuted(userMuted || hidden);
}

export function setUserMuted(muted: boolean): void {
  userMuted = muted;
  applyAudioMute();
}

export function getUserMuted(): boolean {
  return userMuted;
}

export function createSettingsWindow(): BrowserWindow {
  settingsWin = new BrowserWindow({
    width: 520,
    height: 760,
    minWidth: 400,
    minHeight: 500,
    title: "TheOpenPresenter Screen — Settings",
    icon: ICON_PATH,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  loadWindow(settingsWin, "settings");

  // Let the window close normally - showSettingsWindow() recreates it on demand.
  // Hiding instead of closing is unreliable on some Linux compositors (Wayland).
  // The app stays alive via the tray even with no open windows.
  settingsWin.on("closed", () => {
    settingsWin = null;
  });

  return settingsWin;
}

export function createMainWindow(): BrowserWindow {
  mainWin = new BrowserWindow({
    frame: false,
    show: false,
    backgroundColor: "#000000",
    title: "TheOpenPresenter Screen",
    icon: ICON_PATH,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      autoplayPolicy: "no-user-gesture-required",
    },
  });

  loadWindow(mainWin, "main");

  mainWin.on("closed", () => {
    settingsWin?.webContents.send("screen-visibility", false);
    mainWin = null;
  });

  // Register Escape to hide the screen, and DevTools toggles, while focused.
  mainWin.on("focus", () => {
    try {
      globalShortcut.register("Escape", hideScreen);
      const toggleDevTools = (): void => {
        const wc = mainWin?.webContents;
        if (!wc) return;
        if (wc.isDevToolsOpened()) wc.closeDevTools();
        else wc.openDevTools({ mode: "detach" });
      };
      globalShortcut.register("F12", toggleDevTools);
      globalShortcut.register("CommandOrControl+Shift+I", toggleDevTools);
    } catch {}
  });
  mainWin.on("blur", () => {
    globalShortcut.unregister("Escape");
    globalShortcut.unregister("F12");
    globalShortcut.unregister("CommandOrControl+Shift+I");
  });

  return mainWin;
}

export function showSettingsWindow(): void {
  if (!settingsWin || settingsWin.isDestroyed()) {
    createSettingsWindow();
  } else {
    settingsWin.show();
    settingsWin.focus();
  }
}

export function showScreen(): void {
  if (!mainWin || mainWin.isDestroyed()) {
    createMainWindow();
  }
  const win = mainWin!;

  // Resolve target display from settings
  const monitorName = store.get<{ monitor?: string }>("settings")?.monitor;
  let targetDisplay: ReturnType<typeof screen.getAllDisplays>[0] | undefined;
  if (monitorName && monitorName !== "current") {
    targetDisplay = screen
      .getAllDisplays()
      .find((d) => (d.label || String(d.id)) === monitorName);
  }

  win.show();

  if (process.platform === "linux") {
    // On tiling WMs (i3, sway+xwayland) setBounds on a freshly mapped window
    // is overridden by the WM. Use i3-msg/swaymsg with the X11 window ID as
    // criteria to move to the right output then fullscreen. Fall back to the
    // generic Electron API for other compositors.
    setTimeout(() => placeLinuxKiosk(win, targetDisplay), 150);
  } else {
    if (targetDisplay) {
      const { x, y, width, height } = targetDisplay.bounds;
      win.setBounds({ x, y, width, height });
    }
    win.setFullScreen(true);
  }

  win.focus();
  // Restore audio to the user's mute preference now that the window is visible.
  applyAudioMute();
  settingsWin?.webContents.send("screen-visibility", true);
}

function placeLinuxKiosk(
  win: BrowserWindow,
  targetDisplay?: ReturnType<typeof screen.getAllDisplays>[0],
): void {
  // X11 window ID — reliable for i3-msg/swaymsg criteria even after navigation
  const xid = win.getNativeWindowHandle().readUInt32LE(0);
  const criteria = `[id=${xid}]`;

  const outputName =
    targetDisplay?.label || (targetDisplay ? String(targetDisplay.id) : null);
  const cmd =
    outputName && outputName !== "current"
      ? `${criteria} move to output ${outputName}; ${criteria} fullscreen enable`
      : `${criteria} fullscreen enable`;

  // Try i3-msg (X11/i3)
  const i3 = spawnSync("i3-msg", [cmd], { timeout: 2000 });
  if (!i3.error && i3.status === 0) return;

  // Try swaymsg (Sway + XWayland)
  const sway = spawnSync("swaymsg", [cmd], { timeout: 2000 });
  if (!sway.error && sway.status === 0) return;

  // Generic fallback for other compositors
  if (targetDisplay) {
    const { x, y, width, height } = targetDisplay.bounds;
    win.setBounds({ x, y, width, height });
  }
  win.setFullScreen(true);
}

export function hideScreen(): void {
  if (!mainWin || mainWin.isDestroyed()) return;
  // On Linux, hiding directly unmaps the window which exits i3/sway fullscreen
  // automatically. On other platforms, explicitly exit fullscreen first.
  if (process.platform !== "linux") {
    mainWin.setFullScreen(false);
  }
  mainWin.hide();
  // Window is now hidden — mute audio so the still-running renderer is silent.
  applyAudioMute();
  settingsWin?.webContents.send("screen-visibility", false);
}

export function refreshScreen(): void {
  mainWin?.webContents.reload();
}

export function isScreenVisible(): boolean {
  return mainWin != null && !mainWin.isDestroyed() && mainWin.isVisible();
}

export function navigateMain(url: string): void {
  if (!mainWin || mainWin.isDestroyed()) {
    createMainWindow();
  }
  mainWin!.loadURL(url);
}

export function resetMainToRenderer(): void {
  if (!mainWin || mainWin.isDestroyed()) return;
  loadWindow(mainWin, "main");
}
