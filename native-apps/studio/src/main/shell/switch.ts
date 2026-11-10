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

  const url = resolveRootUrl(runtime.url);
  if (!url) {
    throw new Error("That server is not available.");
  }

  showAppWindow(url, organizationSlug);
  refreshMenu();
  return describeConnection(getSettings(), runtime.url);
}

/** Back to the account's server, from Local mode. */
export async function switchToOnline(): Promise<ConnectionSummary> {
  const { rootUrl } = getSettings();
  if (!rootUrl) throw new Error("No account to go online with.");
  const mode: Mode = describeConnection({ mode: "cloud", rootUrl }, null).mode;
  return switchServer(mode, rootUrl);
}
