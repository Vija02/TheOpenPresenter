import { app, ipcMain, shell } from "electron";
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

import { resetClickerScreen } from "./clicker";
import { checkHost } from "./host";
import { applyMonitor, listMonitors } from "./monitor";
import { startPairing, stopPairing } from "./pairing";
import { clearSession, establishSession, listScreens } from "./session";
import { store } from "./store";
import {
  getSettingsWin,
  getUserMuted,
  hideScreen,
  isScreenVisible,
  navigateMain,
  refreshScreen,
  setUserMuted,
  showScreen,
  showSettingsWindow,
} from "./windows";

// ---------------------------------------------------------------------------
// Linux XDG autostart helpers
// ---------------------------------------------------------------------------

function xdgAutostartPath(): string {
  return join(homedir(), ".config", "autostart", "electron-screen.desktop");
}

function enableLinuxAutostart(): void {
  const dir = join(homedir(), ".config", "autostart");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const content = [
    "[Desktop Entry]",
    "Type=Application",
    "Name=TheOpenPresenter Screen",
    `Exec=${process.execPath} --autostart`,
    "Hidden=false",
    "NoDisplay=false",
    "X-GNOME-Autostart-enabled=true",
    "",
  ].join("\n");
  writeFileSync(xdgAutostartPath(), content, "utf8");
}

function disableLinuxAutostart(): void {
  const p = xdgAutostartPath();
  if (existsSync(p)) unlinkSync(p);
}

function isLinuxAutostartEnabled(): boolean {
  return existsSync(xdgAutostartPath());
}

// ---------------------------------------------------------------------------
// IPC handler registration
// ---------------------------------------------------------------------------

export function registerIPC(): void {
  // -- Store ------------------------------------------------------------------
  ipcMain.handle("store:get", (_, args: { key: string }) =>
    store.get(args.key),
  );

  ipcMain.handle("store:set", (_, args: { key: string; value: unknown }) => {
    store.set(args.key, args.value);
    // The clicker caches the resolved screen UUID; invalidate it when the
    // selected screen changes so the next key press re-resolves.
    if (args.key === "screen") resetClickerScreen();
  });

  ipcMain.handle("store:delete", (_, args: { key: string }) => {
    store.delete(args.key);
    if (args.key === "screen") resetClickerScreen();
  });

  // -- Pairing ----------------------------------------------------------------
  ipcMain.handle("start_pairing", (_, args: { rootUrl: string }) => {
    startPairing(args.rootUrl);
  });

  ipcMain.handle("stop_pairing", () => stopPairing());

  // -- Session ----------------------------------------------------------------
  ipcMain.handle(
    "establish_session",
    (_, args: { token: string; rootUrl: string }) =>
      establishSession(args.token, args.rootUrl),
  );

  ipcMain.handle("clear_session", (_, args: { rootUrl: string }) =>
    clearSession(args.rootUrl),
  );

  ipcMain.handle("list_screens", (_, args: { rootUrl: string }) =>
    listScreens(args.rootUrl),
  );

  // -- Host -------------------------------------------------------------------
  ipcMain.handle("check_host", (_, args: { url: string }) =>
    checkHost(args.url),
  );

  // -- Screen window ----------------------------------------------------------
  ipcMain.handle("show_screen", () => showScreen());
  ipcMain.handle("hide_screen", () => hideScreen());
  ipcMain.handle("refresh_screen", () => refreshScreen());
  ipcMain.handle("is_screen_visible", () => isScreenVisible());
  ipcMain.handle("navigate_main", (_, args: { url: string }) =>
    navigateMain(args.url),
  );
  ipcMain.handle("open_settings", () => showSettingsWindow());

  // -- Mute -------------------------------------------------------------------
  ipcMain.handle("mute_supported", () => true);

  // Report the user's explicit mute choice (not the effective state, which is
  // also muted whenever the window is hidden).
  ipcMain.handle("is_screen_muted", () => getUserMuted());

  ipcMain.handle("set_screen_muted", (_, args: { muted: boolean }) => {
    setUserMuted(args.muted);
    getSettingsWin()?.webContents.send("screen-muted", args.muted);
  });

  // -- Monitors ---------------------------------------------------------------
  ipcMain.handle("list_monitors", () => listMonitors());

  ipcMain.handle("apply_monitor", (_, args: { monitorName: string }) =>
    applyMonitor(args.monitorName),
  );

  // -- Autostart --------------------------------------------------------------
  ipcMain.handle("autostart:enable", () => {
    if (process.platform === "linux") {
      enableLinuxAutostart();
    } else {
      app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true });
    }
  });

  ipcMain.handle("autostart:disable", () => {
    if (process.platform === "linux") {
      disableLinuxAutostart();
    } else {
      app.setLoginItemSettings({ openAtLogin: false });
    }
  });

  ipcMain.handle("autostart:isEnabled", () => {
    if (process.platform === "linux") {
      return isLinuxAutostartEnabled();
    }
    return app.getLoginItemSettings().openAtLogin;
  });

  // -- Opener -----------------------------------------------------------------
  ipcMain.handle("opener:open_url", (_, args: { url: string }) =>
    shell.openExternal(args.url),
  );
}
