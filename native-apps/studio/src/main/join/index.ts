import { BrowserWindow, ipcMain } from "electron";

import {
  type DiscoveredHost,
  type DiscoveryEvent,
  helper,
} from "../runtime/helper";
import { describeConnection } from "../settings/connection";
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
  getMainWindow,
  isUnreachableShowing,
  onMainWindowCreated,
  openUnreachableWindow,
  reloadServerWindows,
  showAppWindow,
} from "../shell/windows";
import {
  hideDisconnected,
  isDisconnectedShowing,
  showDisconnected,
} from "./overlay";

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
 * While the computer is away under an open window: the page it covers, when
 * it went, and whether a page load failed meanwhile.
 */
let lost: { page: string | null; since: number; loadFailed: boolean } | null =
  null;
/** Wakes the retry loop early, such as when the user switched away. */
let wakeLoop: (() => void) | null = null;
/**
 * A short drop with the page intact needs no reload: the editor reconnects by
 * itself. Past this, the app's GraphQL connection has given up retrying.
 */
const RELOAD_AFTER_MS = 15_000;

/** Something on screen is waiting for the computer to come back. */
const waiting = () => isUnreachableShowing() || isDisconnectedShowing();

/** `page`'s path on `url`, which may be a new port for the same computer. */
function samePageOn(page: string, url: string): string {
  try {
    const { pathname, search, hash } = new URL(page);
    return new URL(pathname + search + hash, url).toString();
  } catch {
    return url;
  }
}

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
    const was = lost;
    lost = null;
    const intact =
      was?.page &&
      !was.loadFailed &&
      Date.now() - was.since < RELOAD_AFTER_MS &&
      sameHost(new URL(was.page).origin, url);
    if (!intact || !isDisconnectedShowing()) {
      showAppWindow(was?.page ? samePageOn(was.page, url) : url);
    }
    closeUnreachableWindow();
    hideDisconnected();
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
      waiting() &&
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
          wakeLoop = wake;
        });
        wake = null;
        wakeLoop = null;
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
    // Switched to something else meanwhile: the overlay was about this one.
    const now = getSettings();
    if (
      now.mode === "local" ||
      computerAt(now.rootUrl)?.peer !== computer.peer
    ) {
      hideDisconnected();
      lost = null;
    }
    helper.off("discovery", onDiscovery);
    void helper.discoverStop().catch(() => undefined);
  }
}

/**
 * The user switched to something else: the overlay was about the computer
 * left behind, and its retry loop can stop now rather than after its wait.
 */
export function stopWaiting(): void {
  lost = null;
  hideDisconnected();
  wakeLoop?.();
}

/**
 * The computer the app is showing went away. Say so at once rather than
 * leave the next page load to time out on a black window, keep trying, and
 * come back to the same page.
 */
function computerLost({
  peer,
  failedPage,
}: { peer?: string; failedPage?: string } = {}): void {
  const settings = getSettings();
  const computer =
    settings.mode === "local" ? null : computerAt(settings.rootUrl);
  if (!computer || (peer && peer !== computer.peer)) return;
  if (waiting()) return;

  // Only a page from this computer is worth coming back to.
  const page = failedPage ?? getMainWindow()?.webContents.getURL();
  const ours =
    !!page &&
    URL.canParse(page) &&
    sameHost(new URL(page).origin, settings.rootUrl ?? null);
  lost = {
    page: ours ? page : null,
    since: Date.now(),
    loadFailed: !!failedPage,
  };
  logShell("info", "[join] lost the computer; waiting for it");
  const label = describeConnection(settings, null).label;
  // Over the page if there is one; the separate screen otherwise.
  if (!showDisconnected(label)) openUnreachableWindow(label, "");
  waitForComputer().catch((err) =>
    logShell("error", "[join] retrying failed:", err),
  );
}

/** Picking computers on this network, and joining one. */
export function registerJoinIPC(): void {
  helper.on("tunnel-closed", (peer: string) => computerLost({ peer }));

  // In case the drop went unnoticed: a page that fails to load from a
  // computer that doesn't answer either. Not one that answers, or a page that
  // fails for another reason would loop through the unreachable screen.
  onMainWindowCreated((win) => {
    win.webContents.on(
      "did-fail-load",
      (_event, code, _description, url, isMainFrame) => {
        // -3 is an aborted load, such as a navigation replacing another.
        if (!isMainFrame || code === -3) return;
        // The page under the overlay is broken: reload it when it's back.
        if (lost) lost.loadFailed = true;
        const rootUrl = getSettings().rootUrl;
        if (!computerAt(rootUrl)) return;
        void import("../cloud/host")
          .then(({ checkHost }) => checkHost(rootUrl!))
          .then((up) => {
            if (!up) computerLost({ failedPage: url });
          });
      },
    );
  });

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
