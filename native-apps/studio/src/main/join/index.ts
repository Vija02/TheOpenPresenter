import { BrowserWindow, ipcMain } from "electron";

import {
  type DiscoveredHost,
  type DiscoveryEvent,
  helper,
} from "../runtime/helper";
import { sameHost } from "../settings/host";
import {
  type Computer,
  computerAt,
  computerUrl,
  getSettings,
  resolveRootUrl,
  updateSettings,
} from "../settings/store";
import { logShell } from "../shell/log";
import {
  closeUnreachableWindow,
  isUnreachableShowing,
  reloadServerWindows,
  showAppWindow,
} from "../shell/windows";

/** Helper exits that bring the tunnel back, and over what window. */
const MAX_REJOINS = 3;
const REJOIN_WINDOW_MS = 5 * 60 * 1000;

/**
 * Between tries while a joined computer can't be reached. Backs off, since
 * each failed try holds the helper's command loop for its dial timeout;
 * seeing the computer on the network tries at once anyway.
 */
const RETRY_DELAYS_MS = [5000, 10_000, 20_000, 30_000];

/**
 * Open the tunnel to a computer and save it. Returns where it's served here,
 * which moves only if its old port was taken.
 */
async function connect(
  peer: string,
  port?: number | null,
  name?: string | null,
): Promise<string> {
  let joined = await helper.connectRemote(peer, port ?? undefined);
  // Computers are told apart by their port here; two can't share one. `peer`
  // may be a ticket, so compare the ID the helper reports.
  const others = (getSettings().computers ?? []).filter(
    (c) => c.peer !== joined.peer,
  );
  if (others.some((c) => computerUrl(c) === joined.local_url)) {
    joined = await helper.connectRemote(joined.peer, 0);
  }
  const computer: Computer = {
    peer: joined.peer,
    name: joined.name ?? name ?? null,
    port: Number(new URL(joined.local_url).port),
  };
  const settings = getSettings();
  const before = (settings.computers ?? []).find(
    (c) => c.peer === computer.peer,
  );
  const current =
    before &&
    settings.mode !== "local" &&
    sameHost(settings.rootUrl ?? null, computerUrl(before));
  const moved = before && before.port !== computer.port;
  updateSettings({
    computers: [
      ...(settings.computers ?? []).filter((c) => c.peer !== computer.peer),
      computer,
    ],
    ...(moved && current ? { rootUrl: computerUrl(computer) } : {}),
  });
  // The window in use follows it to the new port.
  if (moved && current) {
    reloadServerWindows(computerUrl(before), computerUrl(computer));
  }
  return computerUrl(computer);
}

/**
 * Before talking to `url`: if it's a joined computer, bring its tunnel up.
 * Returns the URL to use.
 */
export async function prepareHost(url: string): Promise<string> {
  const computer = computerAt(url);
  if (!computer) return url;
  return connect(computer.peer, computer.port, computer.name);
}

/**
 * The helper serves one computer at a time: keep the tunnel to the one in
 * use, and none otherwise. Also puts it back after a failed switch.
 */
export async function syncTunnel(): Promise<void> {
  const settings = getSettings();
  if (settings.mode !== "local" && settings.rootUrl) {
    if (computerAt(settings.rootUrl)) {
      await prepareHost(settings.rootUrl).catch((err) =>
        logShell("warn", "[join] could not reopen the tunnel:", err),
      );
      return;
    }
  }
  await helper
    .disconnectRemote()
    .catch((err) => logShell("warn", "[join] disconnect failed:", err));
}

/** Forget a joined computer. */
export async function forgetComputer(url: string): Promise<void> {
  const computer = computerAt(url);
  if (!computer) return;
  updateSettings({
    computers: (getSettings().computers ?? []).filter(
      (c) => c.peer !== computer.peer,
    ),
  });
  await syncTunnel();
}

let retrying: Promise<void> | null = null;

/**
 * Try the configured server again and show it if it answers. Shared, so the
 * "Try again" button and the automatic retry don't race each other.
 */
export function retryCurrent(): Promise<void> {
  retrying ??= (async () => {
    const { runtime } = await import("../runtime/client");
    const { checkHost } = await import("../cloud/host");
    const url = await prepareHost(resolveRootUrl(runtime.url)).catch(() => "");
    if (!url || !(await checkHost(url))) {
      throw new Error("Still unreachable.");
    }
    showAppWindow(url);
    closeUnreachableWindow();
  })().finally(() => {
    retrying = null;
  });
  return retrying;
}

/**
 * While the unreachable screen shows a joined computer, keep trying, and try
 * at once when it's seen on the network. Resolves true once it's back.
 */
export async function waitForComputer(): Promise<boolean> {
  const computer = computerAt(getSettings().rootUrl);
  if (!computer) return false;
  // Stops once the user has switched to something else from settings.
  const stillWanted = () => {
    const settings = getSettings();
    return (
      isUnreachableShowing() &&
      settings.mode !== "local" &&
      computerAt(settings.rootUrl)?.peer === computer.peer
    );
  };

  let wake: (() => void) | null = null;
  const onDiscovery = (event: DiscoveryEvent) => {
    if (event.event === "host_discovered" && event.host.id === computer.peer) {
      wake?.();
    }
  };
  helper.on("discovery", onDiscovery);
  const listed = await helper.discoverStart().catch(() => []);
  // Already seen: no new event will come for it, so try straight away.
  let tryNow = listed.some((host) => host.id === computer.peer);

  try {
    for (let attempt = 0; stillWanted(); attempt++) {
      if (!tryNow) {
        const delay =
          RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, delay);
          wake = () => {
            clearTimeout(timer);
            resolve();
          };
        });
        wake = null;
        if (!stillWanted()) break;
      }
      tryNow = false;
      try {
        await retryCurrent();
        logShell("info", "[join] the computer is back");
        return true;
      } catch {
        // Still away; go round again.
      }
    }
    return false;
  } finally {
    helper.off("discovery", onDiscovery);
    void helper.discoverStop().catch(() => undefined);
  }
}

/** Picking computers on this network, and joining one. */
export function registerJoinIPC(): void {
  helper.on("discovery", (event) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send("join:discovery", event);
    }
  });

  // A helper that died took the tunnel with it. Bring it back, but give up
  // on one that dies every time.
  let rejoins: number[] = [];
  helper.on("unexpected-exit", () => {
    const settings = getSettings();
    if (settings.mode === "local" || !settings.rootUrl) return;
    const url = settings.rootUrl;
    if (!computerAt(url)) return;
    const now = Date.now();
    rejoins = rejoins.filter((at) => now - at < REJOIN_WINDOW_MS);
    if (rejoins.length >= MAX_REJOINS) {
      logShell("error", "[join] helper keeps exiting; not rejoining");
      return;
    }
    rejoins.push(now);
    // Whatever is current by then: the user may have switched meanwhile.
    setTimeout(() => void syncTunnel(), 1000);
  });

  ipcMain.handle(
    "join:discover-start",
    (): Promise<DiscoveredHost[]> => helper.discoverStart(),
  );

  ipcMain.handle("join:discover-stop", () => helper.discoverStop());

  /** Join a computer and switch the app to it. */
  ipcMain.handle(
    "join:connect",
    async (
      _event,
      args: { peer: string; port?: number | null; name?: string | null },
    ) => {
      // The picker stops discovery when it closes; a failed join keeps it
      // open and still listening.
      const { computers, rootUrl } = getSettings();
      try {
        const url = await connect(args.peer, args.port, args.name);
        const { switchServer } = await import("../shell/switch");
        return await switchServer("selfhosted", url);
      } catch (err) {
        // Don't keep a computer that never worked, and put back the tunnel
        // the open window was using.
        updateSettings({ computers: computers ?? [], rootUrl });
        await syncTunnel();
        throw err;
      }
    },
  );
}
