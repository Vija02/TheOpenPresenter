import { app, shell } from "electron";
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";

/** Starting the app when the user logs in, so a screen can come up unattended. */

export type LoginItemState =
  | { status: "on" | "off" }
  /** macOS registered it, but the user has to allow it in System Settings. */
  | { status: "needs-approval" }
  | { status: "unavailable"; reason: string };

/** What the switch should say, from what the platform reports. */
export function loginItemState({
  platform,
  packaged,
  inApplications,
  enabled,
  macStatus,
}: {
  platform: NodeJS.Platform;
  packaged: boolean;
  inApplications: boolean;
  enabled: boolean;
  macStatus?: string;
}): LoginItemState {
  if (!packaged) {
    // A dev build would register the bare Electron binary.
    return { status: "unavailable", reason: "Only in the installed app." };
  }
  if (platform === "darwin" && !inApplications) {
    // Run from the DMG or Downloads, macOS registers a temporary copy.
    return {
      status: "unavailable",
      reason: "Move TheOpenPresenter to Applications first.",
    };
  }
  if (platform === "darwin" && macStatus === "requires-approval") {
    return { status: "needs-approval" };
  }
  return { status: enabled ? "on" : "off" };
}

/**
 * An `Exec=` value running `path` with no arguments. Quoted per the desktop
 * entry spec, then escaped again as a string value.
 */
export function desktopExec(path: string): string {
  const quoted = `"${path.replace(/[\\"`$]/g, "\\$&")}"`;
  return quoted.replace(/\\/g, "\\\\").replace(/%/g, "%%");
}

function xdgAutostartPath(): string {
  const config = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(config, "autostart", "com.theopenpresenter.studio.desktop");
}

export function launchAtLoginState(): LoginItemState {
  const linux = process.platform === "linux";
  const settings = linux ? null : app.getLoginItemSettings();
  return loginItemState({
    platform: process.platform,
    packaged: app.isPackaged,
    inApplications:
      process.platform === "darwin" ? app.isInApplicationsFolder() : true,
    enabled: linux ? existsSync(xdgAutostartPath()) : settings!.openAtLogin,
    macStatus: settings?.status,
  });
}

export function setLaunchAtLogin(enabled: boolean): LoginItemState {
  if (launchAtLoginState().status === "unavailable") {
    return launchAtLoginState();
  }
  if (process.platform !== "linux") {
    app.setLoginItemSettings({ openAtLogin: enabled });
    return launchAtLoginState();
  }

  const path = xdgAutostartPath();
  if (!enabled) {
    if (existsSync(path)) unlinkSync(path);
    return launchAtLoginState();
  }
  // An AppImage's execPath is inside a mount that is gone after a reboot.
  const exec = process.env.APPIMAGE || process.execPath;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    [
      "[Desktop Entry]",
      "Type=Application",
      "Name=TheOpenPresenter",
      `Exec=${desktopExec(exec)}`,
      "X-GNOME-Autostart-enabled=true",
      "",
    ].join("\n"),
    "utf8",
  );
  return launchAtLoginState();
}

/** Where macOS asks the user to allow login items. */
export function openLoginItemsSettings(): Promise<void> {
  if (process.platform !== "darwin") return Promise.resolve();
  return shell.openExternal(
    "x-apple.systempreferences:com.apple.LoginItems-Settings.extension",
  );
}
