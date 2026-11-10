import {
  Menu,
  type MenuItemConstructorOptions,
  app,
  dialog,
  shell,
} from "electron";

import { runtime } from "../runtime/client";
import { describeConnection, hostLabel } from "../settings/connection";
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
 * Moving between Online (the account's server) and Local (this computer),
 * offered only when the other side is there to move to.
 */
function switchItems(): MenuItemConstructorOptions[] {
  const settings = getSettings();
  if (!settings.mode) return [];

  const run = (action: () => Promise<unknown>) => () =>
    void action().catch((err) => {
      logShell("error", "[menu] switch failed:", err);
      dialog.showErrorBox(
        "Couldn't switch",
        err instanceof Error ? err.message : String(err),
      );
    });

  if (settings.mode === "local") {
    if (!settings.rootUrl) return [];
    const label = describeConnection(settings, null).isCloud
      ? "TheOpenPresenter Cloud"
      : hostLabel(settings.rootUrl);
    return [
      {
        label: `Switch to Online (${label})`,
        click: run(async () => (await import("./switch")).switchToOnline()),
      },
      { type: "separator" },
    ];
  }

  if (!runtime.url) return [];
  return [
    {
      label: "Switch to Local (this computer)",
      click: run(async () => (await import("./switch")).switchServer("local")),
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
        ...switchItems(),
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
