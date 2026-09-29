import { ipcMain, shell } from "electron";
import { join } from "path";

import { localAddress } from "../cloud/host";
import {
  DEFAULT_CHANNEL,
  getSettings,
  resolveRuntimeSource,
  updateSettings,
} from "../settings/store";
import { refreshMenu } from "../shell/menu";
import { showAppWindow } from "../shell/windows";
import { runtime } from "./client";
import { registerTicket } from "./remote";

/** Installing, activating, starting and inspecting the local runtime. */
export function registerRuntimeIPC(): void {
  // -- Local runtime --------------------------------------------------------
  ipcMain.handle("runtime:status", async () => {
    if (!runtime.isRunning) {
      // Try once more before reporting a problem
      try {
        runtime.start({ source: resolveRuntimeSource() });
      } catch (err) {
        return {
          available: false as const,
          reason: err instanceof Error ? err.message : String(err),
        };
      }
    }

    try {
      const status = await runtime.status();
      return { available: true as const, ...status, url: runtime.url };
    } catch (err) {
      return {
        available: false as const,
        reason: err instanceof Error ? err.message : String(err),
      };
    }
  });

  ipcMain.handle("runtime:check", (_event, channel?: string) =>
    runtime.check(channel ?? getSettings().channel ?? DEFAULT_CHANNEL),
  );

  /** Download a runtime. Progress streams over `runtime:progress` */
  ipcMain.handle("runtime:install", async (_event, channel?: string) => {
    const status = await runtime.status().catch(() => null);
    const activate = !status?.running;

    const result = await runtime.ensure(
      channel ?? getSettings().channel ?? DEFAULT_CHANNEL,
      activate,
    );

    return { ...result, pendingRestart: !activate };
  });

  ipcMain.handle("runtime:activate", (_event, version: string) =>
    runtime.activate(version),
  );

  ipcMain.handle("runtime:start", async (_event, args?: { open?: boolean }) => {
    const result = await runtime.startRuntime();

    if (args?.open !== false) {
      updateSettings({ mode: "local" });
      showAppWindow(runtime.url ?? result.url);
      refreshMenu();
    }
    return {
      ...result,
      url: runtime.url ?? result.url,
      lanAddress: localAddress(),
    };
  });

  /** Open the window into a server that is already running */
  ipcMain.handle("runtime:open", () => {
    if (!runtime.url) {
      throw new Error("The local server is not running.");
    }
    updateSettings({ mode: "local" });
    showAppWindow(runtime.url);
    refreshMenu();
    return { url: runtime.url };
  });

  ipcMain.handle("runtime:stop", () => runtime.stopRuntime());

  ipcMain.handle("runtime:restart", async () => {
    await runtime.stopRuntime(true);
    const result = await runtime.startRuntime();
    const url = runtime.url ?? result.url;
    showAppWindow(url);
    refreshMenu();
    return { ...result, url, lanAddress: localAddress() };
  });

  ipcMain.handle("runtime:prune", (_event, keep: string[]) =>
    runtime.prune(keep),
  );

  /** Open the runtime log in the user's default text editor. */
  ipcMain.handle("runtime:open-logs", async () => {
    const paths = await runtime.paths();
    const log = join(paths.logs, "runtime.log");
    shell.showItemInFolder(log);
    return log;
  });

  ipcMain.handle("runtime:paths", () => runtime.paths());

  ipcMain.handle("runtime:reveal", async (_event, which: "data" | "root") => {
    const paths = await runtime.paths();
    const target = which === "data" ? paths.data : paths.root;
    shell.openPath(target);
    return target;
  });

  // -- Remote access --------------------------------------------------------

  ipcMain.handle("runtime:remote-status", () => runtime.remoteStatus());

  ipcMain.handle("runtime:remote-start", async () => {
    const status = await runtime.startRemote();
    console.log("[remote] tunnel started, enabled=" + status.enabled);

    if (status.enabled && status.ticket && status.node_id) {
      await registerTicket(status.ticket, status.node_id);
    }

    updateSettings({ remoteAccess: true });
    return status;
  });

  ipcMain.handle("runtime:remote-stop", async () => {
    const status = await runtime.stopRemote();
    console.log("[remote] tunnel stopped");
    updateSettings({ remoteAccess: false });
    return status;
  });
}
