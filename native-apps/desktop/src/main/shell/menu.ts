import { Menu, type MenuItemConstructorOptions, app, shell } from "electron";

import { WEBSITE_URL } from "./about";
import { openDataFolder } from "./data-folder";
import { resetSetup } from "./reset";
import {
  closeAllPresentWindows,
  getMainWindow,
  openPanelWindow,
} from "./windows";

export function setupMenu(): void {
  const isMac = process.platform === "darwin";

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? ([
          {
            label: app.getName(),
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ] satisfies MenuItemConstructorOptions[])
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "Settings",
          accelerator: "CmdOrCtrl+,",
          click: () => openPanelWindow(),
        },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
        {
          label: "Stop presenting",
          accelerator: "CmdOrCtrl+Shift+P",
          click: () => closeAllPresentWindows(),
        },
      ],
    },
    {
      label: "Debug",
      submenu: [
        {
          label: "Reload page",
          accelerator: "CmdOrCtrl+R",
          click: () => getMainWindow()?.webContents.reload(),
        },
        { role: "toggleDevTools", label: "Inspect element" },
        {
          label: "Open data folder",
          click: () => void openDataFolder(),
        },
        { type: "separator" },
        {
          // Destructive, and the only item here that cannot be undone.
          label: "Clear and reset data",
          click: () => void resetSetup(),
        },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Website",
          click: () => shell.openExternal(WEBSITE_URL).catch(() => {}),
        },
        { type: "separator" },
        {
          label: "About TheOpenPresenter",
          click: () => openPanelWindow("about"),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

export function refreshMenu(): void {
  setupMenu();
}
