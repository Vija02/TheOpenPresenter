import { ipcMain, shell } from "electron";

import { runtime } from "../runtime/client";
import { describeConnection, hostLabel } from "../settings/connection";
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
import {
  backToShellUI,
  closeUnreachableWindow,
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
    async (_event, args: { mode: Mode; rootUrl?: string }) => {
      const patch: Partial<Settings> = { mode: args.mode };
      if (args.mode === "local") {
        patch.autoStartRuntime = true;
      } else if (args.rootUrl) {
        const target = normalizeHost(args.rootUrl);

        // Probe before writing anything. Committing first and failing after
        // left the app pointed at an instance that was never reachable, with
        // the only way back being the menu.
        const { checkHost } = await import("../cloud/host");
        if (!(await checkHost(target))) {
          throw new Error(
            `Could not reach ${hostLabel(target)}. Check the address and that the instance is running.`,
          );
        }
        patch.rootUrl = target;
      }
      updateSettings(patch);

      if (args.mode === "local" && !runtime.url) {
        await runtime.startRuntime();
      }

      const url = resolveRootUrl(runtime.url);
      if (!url) {
        throw new Error("That server is not available.");
      }

      showAppWindow(url);
      refreshMenu();
      return describeConnection(getSettings(), runtime.url);
    },
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
