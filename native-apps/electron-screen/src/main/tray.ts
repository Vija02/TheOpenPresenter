import { Menu, Tray, app, nativeImage } from "electron";

import { ICON_PATH, showSettingsWindow } from "./windows";

let tray: Tray | null = null;

export function setupTray(): void {
  let icon = nativeImage.createFromPath(ICON_PATH);
  // Tray icons are small; scale the 512px app icon down so it renders crisply.
  if (icon.isEmpty()) icon = nativeImage.createEmpty();
  else icon = icon.resize({ width: 24, height: 24 });

  tray = new Tray(icon);
  tray.setToolTip("TheOpenPresenter Screen");

  const menu = Menu.buildFromTemplate([
    { label: "Open Settings", click: () => showSettingsWindow() },
    { type: "separator" },
    { label: "Quit", click: () => app.exit(0) },
  ]);
  tray.setContextMenu(menu);
  tray.on("click", () => showSettingsWindow());
}
