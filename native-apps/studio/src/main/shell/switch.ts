import { webContents } from "electron";

import { runtime } from "../runtime/client";
import {
  type ConnectionSummary,
  describeConnection,
  hostLabel,
} from "../settings/connection";
import {
  type Mode,
  type Settings,
  getSettings,
  normalizeHost,
  resolveRootUrl,
  updateSettings,
} from "../settings/store";
import { refreshMenu } from "./menu";
import { refreshSetupBar } from "./setupBar";
import { showAppWindow } from "./windows";

/**
 * Online is the account's server; Local is this computer. Switching keeps
 * both: the sign-in stays, and the local server keeps running in the
 * background so switching back is instant.
 */
export async function switchServer(
  mode: Mode,
  rootUrl?: string,
  organizationSlug?: string,
): Promise<ConnectionSummary> {
  const patch: Partial<Settings> = { mode };
  if (mode === "local") {
    patch.autoStartRuntime = true;
  } else if (rootUrl) {
    const target = normalizeHost(rootUrl);

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

  // Started before the mode is saved, so a server that will not start does
  // not leave the next launch trying Local.
  if (mode === "local" && !runtime.url) {
    await runtime.startRuntime();
  }

  updateSettings(patch);
  // The offline setup only shows online; organization copies show anywhere.
  refreshSetupBar();

  const url = resolveRootUrl(runtime.url);
  if (!url) {
    throw new Error("That server is not available.");
  }

  showAppWindow(url, organizationSlug);
  refreshMenu();
  const summary = describeConnection(getSettings(), runtime.url);
  // Settings may be open on another window, showing the old mode.
  for (const contents of webContents.getAllWebContents()) {
    if (!contents.isDestroyed()) contents.send("app:switched", summary);
  }
  return summary;
}

