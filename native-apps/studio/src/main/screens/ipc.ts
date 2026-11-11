import { type IpcMainInvokeEvent, ipcMain, screen } from "electron";

import { isShellPage } from "../shell/origins";
import {
  type VirtualScreen,
  assignDisplays,
  displayTakenBy,
  getVirtualScreens,
  removeVirtualScreen,
  saveVirtualScreen,
  trimHost,
} from "./config";
import {
  launchAtLoginState,
  openLoginItemsSettings,
  setLaunchAtLogin,
} from "./loginItem";
import { listCatalog, sourceLabel } from "./sources";
import {
  closeScreen,
  openScreen,
  screenState,
  syncAll,
  watchLocalServer,
} from "./windows";

/**
 * Only Studio's own windows: a server's page must not add a host, which would
 * then be trusted like the app.
 */
function handle<A extends unknown[], R>(
  channel: string,
  fn: (event: IpcMainInvokeEvent, ...args: A) => R,
): void {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isShellPage(event.senderFrame?.url)) {
      throw new Error(`${channel} is only available to Studio's own windows.`);
    }
    return fn(event, ...(args as A));
  });
}

function checkSource(source: VirtualScreen["source"]): VirtualScreen["source"] {
  if (source.kind === "local") return { kind: "local" };
  const url = new URL(source.host);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("A screen's server must be an http(s) address.");
  }
  return { kind: "remote", host: trimHost(url.origin + url.pathname) };
}

/** Screens this computer shows by itself. */
export function registerScreensIPC(): void {
  watchLocalServer();

  handle("screens:list", () => {
    const screens = getVirtualScreens();
    const placed = assignDisplays(
      screens,
      screen.getAllDisplays(),
      screen.getPrimaryDisplay(),
    );
    return screens.map((s) => {
      const d = placed.get(s.id);
      return {
        ...s,
        state: screenState(s.id),
        // The display it is on now, or null when that one is not connected.
        displayId: d ? String(d.id) : null,
        sourceLabel: sourceLabel(s.source),
      };
    });
  });

  handle("screens:catalog", () => listCatalog());

  handle(
    "screens:save",
    async (_event, input: Omit<VirtualScreen, "id"> & { id?: string }) => {
      const taken = displayTakenBy(
        getVirtualScreens(),
        input,
        screen.getAllDisplays(),
        screen.getPrimaryDisplay(),
      );
      if (taken) {
        throw new Error(
          `${taken.screenName || taken.screenSlug} is already on that display.`,
        );
      }
      // Remember where the display is, to draw it while it is unplugged.
      const display = screen
        .getAllDisplays()
        .find((d) => String(d.id) === input.monitorId);
      const saved = saveVirtualScreen({
        ...input,
        source: checkSource(input.source),
        ...(display && { monitorBounds: display.bounds }),
      });
      // An open screen follows its new display or address; the list updates
      // when it has moved.
      void syncAll();
      return saved;
    },
  );

  handle("screens:remove", (_event, id: string) => {
    removeVirtualScreen(id);
    void syncAll();
  });

  handle("screens:open", (_event, id: string) => openScreen(id));
  handle("screens:close", (_event, id: string) => closeScreen(id));

  handle("screens:launch-at-login", () => launchAtLoginState());
  handle("screens:set-launch-at-login", (_event, enabled: boolean) => {
    return setLaunchAtLogin(enabled);
  });
  handle("screens:open-login-items", () => openLoginItemsSettings());
}
