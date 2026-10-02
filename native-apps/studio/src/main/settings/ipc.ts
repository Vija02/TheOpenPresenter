import { ipcMain } from "electron";

import { runtime } from "../runtime/client";
import { logShell } from "../shell/log";
import {
  type Settings,
  getSettings,
  normalizeHost,
  resolveRuntimeSource,
  updateSettings,
} from "./store";

/** Reading and writing the shell's own preferences. */
export function registerSettingsIPC(): void {
  // -- Settings -------------------------------------------------------------
  ipcMain.handle("settings:get", () => getSettings());

  ipcMain.handle(
    "settings:update",
    async (_event, patch: Partial<Settings>) => {
      const before = getSettings().runtimeSource;
      const next = updateSettings(patch);

      if (patch.runtimeSource !== undefined && patch.runtimeSource !== before) {
        await runtime.shutdown().catch(() => {});
        try {
          runtime.start({ source: resolveRuntimeSource() });
        } catch (err) {
          logShell(
            "error",
            "[ipc] could not restart the runtime manager:",
            err,
          );
        }
      }

      return next;
    },
  );

  ipcMain.handle("settings:normalize-host", (_event, input: string) =>
    normalizeHost(input),
  );
}
