import { ipcMain, shell } from "electron";

import { runtime } from "../runtime/client";
import { describeConnection } from "../settings/connection";
import {
  type Mode,
  type Settings,
  getSettings,
  normalizeHost,
  resolveRootUrl,
  updateSettings,
} from "../settings/store";
import { WEBSITE_URL, aboutInfo } from "./about";
import { openExternalSafely } from "./external";
import { refreshMenu } from "./menu";
import { switchServer } from "./switch";
import {
  checkForUpdates,
  downloadUpdates,
  installUpdate,
  runtimeUpdateState,
  updateState,
} from "./updates";
import {
  backToShellUI,
  closeUnreachableWindow,
  closeUpdateWindow,
  openPanelWindow,
  showAppWindow,
} from "./windows";

/** Committing to a server, and leaving it again. */
export function registerAppIPC(): void {
  /** What the app is currently pointed at, for menus and the switcher. */
  ipcMain.handle("app:connection", () =>
    describeConnection(getSettings(), runtime.url),
  );

  /**
   * Point the app at a different server
   */
  ipcMain.handle(
    "app:switch-server",
    (_event, args: { mode: Mode; rootUrl?: string }) =>
      switchServer(args.mode, args.rootUrl),
  );

  /** Commit to a mode and open the app against it. */
  ipcMain.handle(
    "app:connect",
    async (_event, args: { mode: Mode; rootUrl?: string }) => {
      const patch: Partial<Settings> = { mode: args.mode };
      if (args.rootUrl) patch.rootUrl = normalizeHost(args.rootUrl);
      updateSettings(patch);

      const url = resolveRootUrl(runtime.url);
      if (!url) {
        throw new Error(
          "No server to connect to. Start the local runtime first.",
        );
      }
      showAppWindow(url);
      refreshMenu();
      return { url };
    },
  );

  ipcMain.handle("app:back-to-shell", () => backToShellUI());

  /** Open settings from a window that has no menu of its own. */
  ipcMain.handle("app:open-settings", () => {
    openPanelWindow("server");
  });

  // -- App updates ----------------------------------------------------------

  ipcMain.handle("update:state", () => updateState());
  ipcMain.handle("update:check", () => checkForUpdates());
  ipcMain.handle("update:runtime", () => runtimeUpdateState());
  ipcMain.handle("update:download", () => downloadUpdates());
  ipcMain.handle("update:install", () => installUpdate());
  ipcMain.handle("update:dismiss", () => closeUpdateWindow());

  /**
   * Try the configured instance again after it was unreachable at startup.
   */
  ipcMain.handle("app:retry-connection", async () => {
    const url = resolveRootUrl(runtime.url);
    const { checkHost } = await import("../cloud/host");
    if (!url || !(await checkHost(url))) {
      throw new Error("Still unreachable.");
    }
    showAppWindow(url);
    closeUnreachableWindow();
  });

  // This channel is reachable from whatever page is loaded, so an unfiltered
  // openExternal would let that page launch a file: URL or an OS handler.
  ipcMain.handle("app:open-external", (_event, url: string) =>
    openExternalSafely(url),
  );

  // -- About ----------------------------------------------------------------

  ipcMain.handle("app:about", () => aboutInfo());

  ipcMain.handle("app:website", () =>
    shell.openExternal(WEBSITE_URL).catch(() => {}),
  );

  // Copying beats retyping six version numbers into a bug report.
  ipcMain.handle("app:copy-text", async (_event, text: string) => {
    const { clipboard } = await import("electron");
    clipboard.writeText(text);
  });
}
