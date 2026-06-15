import { Menu, Tray, app, nativeImage } from "electron";
import { join } from "path";

import { showSettingsWindow } from "./windows";

let tray: Tray | null = null;

export function setupTray(): void {
  let icon = nativeImage.createEmpty();
  try {
    const iconPath = join(__dirname, "../../resources/tray-icon.png");
    const loaded = nativeImage.createFromPath(iconPath);
    if (!loaded.isEmpty()) icon = loaded;
  } catch {}

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
