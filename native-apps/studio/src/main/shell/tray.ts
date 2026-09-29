import { Menu, Tray, app, nativeImage } from "electron";

import {
  ICON_PATH,
  backToShellUI,
  closeAllPresentWindows,
  getMainWindow,
} from "./windows";

let tray: Tray | null = null;

export function setupTray(): void {
  let icon = nativeImage.createFromPath(ICON_PATH);
  icon = icon.isEmpty()
    ? nativeImage.createEmpty()
    : icon.resize({ width: 24, height: 24 });

  tray = new Tray(icon);
  tray.setToolTip("TheOpenPresenter");

  const show = (): void => {
    const win = getMainWindow();
    if (!win || win.isDestroyed()) backToShellUI();
    else {
      win.show();
      win.focus();
    }
  };

  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open TheOpenPresenter", click: show },
      {
        label: "Stop presenting",
        click: () => closeAllPresentWindows(),
      },
      {
        label: "Settings and mode",
        click: () => {
          show();
          backToShellUI();
        },
      },
      { type: "separator" },
      { label: "Quit", click: () => app.quit() },
    ]),
  );

  tray.on("click", show);
}
