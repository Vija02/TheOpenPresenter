import {
  Menu,
  type MenuItemConstructorOptions,
  app,
  dialog,
  shell,
} from "electron";

import { runtime } from "../runtime/client";
import { getSettings } from "../settings/store";
import { WEBSITE_URL } from "./about";
import { openDataFolder } from "./data-folder";
import { logShell } from "./log";
import { resetSetup } from "./reset";
import {
  closeAllPresentWindows,
  getMainWindow,
  openPanelWindow,
} from "./windows";

/**
 * Going offline, while online with a local server to go to. Going back online
 * is in Settings > Accounts.
 */
function goOfflineItems(): MenuItemConstructorOptions[] {
  const settings = getSettings();
  if (!settings.mode || settings.mode === "local") return [];
  // Mid-setup, the setup card owns this.
  if (!runtime.url || settings.pendingLocal) return [];

  return [
    {
      label: "Go offline",
      click: () =>
        void import("./switch")
          .then(({ switchServer }) => switchServer("local"))
          .catch((err) => {
            logShell("error", "[menu] go offline failed:", err);
            dialog.showErrorBox(
              "Couldn't go offline",
              err instanceof Error ? err.message : String(err),
            );
          }),
    },
    { type: "separator" },
  ];
}

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
        ...goOfflineItems(),
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
