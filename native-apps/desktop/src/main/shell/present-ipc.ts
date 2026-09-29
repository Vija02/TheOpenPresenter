import { ipcMain } from "electron";

import { isAllowedAppUrl } from "./origins";
import {
  closeAllPresentWindows,
  closePresentWindow,
  listMonitors,
  listPresentWindows,
  openPresentWindow,
} from "./windows";

export function registerPresentIPC(): void {
  // -- Presentation ---------------------------------------------------------
  ipcMain.handle("present:monitors", () => listMonitors());

  ipcMain.handle(
    "present:open",
    (
      _event,
      args: { url: string; monitorIndex: number; rendererId?: string },
    ) => {
      // The URL comes from the page, and a presentation window carries the
      // same preload bridge.
      if (!isAllowedAppUrl(args.url)) {
        throw new Error("Refused to present a URL from outside this server.");
      }
      openPresentWindow(args.url, args.monitorIndex, args.rendererId ?? "1");
      return listPresentWindows();
    },
  );

  ipcMain.handle("present:close", (_event, rendererId?: string) => {
    closePresentWindow(rendererId ?? "1");
    return listPresentWindows();
  });

  ipcMain.handle("present:close-all", () => {
    closeAllPresentWindows();
    return listPresentWindows();
  });

  ipcMain.handle("present:list", () => listPresentWindows());
}
