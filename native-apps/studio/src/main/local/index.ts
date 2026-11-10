import { ipcMain, webContents } from "electron";

import {
  allOrganizations,
  connectCloudOrganization,
  firstSyncProgress,
} from "../cloud/connection";
import { runtime } from "../runtime/client";
import { sameHost } from "../settings/host";
import {
  DEFAULT_CHANNEL,
  type PendingLocal,
  getSettings,
  updateSettings,
} from "../settings/store";
import { logShell } from "../shell/log";
import { refreshSetupBar, setSetupBarRule } from "../shell/setupBar";
import { switchServer } from "../shell/switch";
import { FirstSync, type FirstSyncState } from "./firstSync";
import { LocalSetup, type LocalSetupState } from "./setup";

/** The one offline setup this app runs, wired to the real runtime. */
export const localSetup = new LocalSetup({
  installed: async () => !!(await runtime.status()).current,
  ensure: (channel) => runtime.ensure(channel, true),
  onProgress: (handler) => {
    runtime.on("progress", handler);
    return () => runtime.off("progress", handler);
  },
  startRuntime: () => runtime.startRuntime(),
  localOrganizations: allOrganizations,
  connectOrganization: connectCloudOrganization,
  syncProgress: firstSyncProgress,
});

/** Organizations copied from settings, after setup. */
export const firstSync = new FirstSync({ syncProgress: firstSyncProgress });

export type SetupBarContent =
  | {
      kind: "setup";
      state: LocalSetupState & { canSwitch: boolean };
      /** Shown as a dialog over the window rather than in the card. */
      announce: boolean;
    }
  | { kind: "sync"; state: FirstSyncState }
  | null;

/** Hidden by the user until there is something new to say. */
let dismissed = false;
/** "Ready" interrupts once, then waits in the card. */
let announceReady = false;

/** One thing at a time: the offline setup while online, else any copies. */
function barContent(): SetupBarContent {
  const online = getSettings().mode !== "local";
  if (online && localSetup.hasPlan && localSetup.state.phase !== "idle") {
    return {
      kind: "setup",
      state: localSetup.snapshot(),
      announce: announceReady && localSetup.state.phase === "ready",
    };
  }
  if (firstSync.state.phase !== "idle") {
    return { kind: "sync", state: firstSync.state };
  }
  return null;
}

// Every page, not every window: the bar is a view inside the app window.
function broadcast(channel: string, payload: unknown): void {
  for (const contents of webContents.getAllWebContents()) {
    if (!contents.isDestroyed()) contents.send(channel, payload);
  }
}

setSetupBarRule(() => {
  const content = barContent();
  if (dismissed || !content) return "hidden";
  return content.kind === "setup" && content.announce ? "cover" : "card";
});

function updateBar(): void {
  broadcast("setup-bar:content", barContent());
  refreshSetupBar();
}

let wasReady = false;
localSetup.on("state", (state) => {
  broadcast("local-setup:state", state);
  // Worth seeing again once it is ready, or if it went wrong.
  if (state.phase === "ready" || state.phase === "failed") dismissed = false;
  if (state.phase === "ready" && !wasReady) announceReady = true;
  wasReady = state.phase === "ready";
  updateBar();
  if (state.phase === "failed") {
    logShell("error", "[local-setup] failed:", state.message);
  }
});

firstSync.on("state", (state: FirstSyncState) => {
  if (state.phase === "done") dismissed = false;
  updateBar();
});

/** Follow a newly connected organization's first copy on the bar. */
export function watchFirstSync(
  base: string,
  connectionId: string,
  name: string,
): void {
  dismissed = false;
  firstSync.watch(base, connectionId, name).catch((err) => {
    logShell("error", "[first-sync] could not follow:", err);
  });
}

function channel(): string {
  return getSettings().channel ?? DEFAULT_CHANNEL;
}

/**
 * Whether the runtime is already on this computer. Asked of the download rather
 * than the manager, which runs one command at a time and would make a status
 * request wait behind a download still in progress. A download that has not
 * settled almost at once is a real one, still going.
 */
function isDownloaded(): Promise<boolean> {
  return Promise.race([
    localSetup.download(channel()).then(
      () => true,
      () => false,
    ),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1500)),
  ]);
}

/** Resolves once there is a local server to open; rejects if setup fails. */
function untilSwitchable(): Promise<void> {
  return new Promise((resolve, reject) => {
    const check = () => {
      const state = localSetup.state;
      if (localSetup.canSwitch) {
        localSetup.off("state", check);
        resolve();
      } else if (state.phase === "failed") {
        localSetup.off("state", check);
        reject(new Error(state.message));
      }
    };
    localSetup.on("state", check);
    check();
  });
}

/** Carry on with a setup a restart interrupted. */
export function resumeLocalSetup(): void {
  const pending = getSettings().pendingLocal;
  if (!pending) return;
  logShell("info", "[local-setup] resuming");
  void localSetup.begin(pending, channel());
  updateBar();
}

export async function switchToLocal(): Promise<void> {
  const target = localSetup.target;
  if (!target) throw new Error("This computer is not ready yet.");
  // Copies still under way carry on after the switch; the bar follows them.
  const unfinished =
    localSetup.state.phase === "syncing" ? localSetup.copies : [];
  // Cleared only once switched: a failed switch keeps the bar and the plan.
  await switchServer("local", undefined, target.organizationSlug ?? undefined);
  updateSettings({ pendingLocal: undefined });
  announceReady = false;
  localSetup.reset();
  for (const copy of unfinished) watchFirstSync(target.url, copy.id, copy.name);
}

/** Drop a setup that copies from this account, which is going away. */
export function cancelLocalSetupFor(rootUrl: string): void {
  const pending = getSettings().pendingLocal;
  if (!pending || !sameHost(pending.rootUrl, rootUrl)) return;
  updateSettings({ pendingLocal: undefined });
  localSetup.reset();
}

export function registerLocalSetupIPC(): void {
  ipcMain.handle("local-setup:state", () => localSetup.snapshot());
  ipcMain.handle("setup-bar:content", () => barContent());

  /** Start the download early, during setup, before anything else is known. */
  ipcMain.handle("local-setup:download", (_event, requested?: string) => {
    localSetup.download(requested ?? channel()).catch(() => undefined);
  });

  ipcMain.handle("local-setup:wait-download", () =>
    localSetup.waitForDownload(),
  );

  /**
   * What to copy, once signed in. With the runtime already on this computer
   * there is nothing to wait for, so this opens Local directly and returns
   * `direct: true`. Otherwise the rest carries on in the background and the
   * caller goes online.
   */
  ipcMain.handle(
    "local-setup:begin",
    async (_event, plan: PendingLocal): Promise<{ direct: boolean }> => {
      // The account, kept for switching back online later.
      updateSettings({ pendingLocal: plan, rootUrl: plan.rootUrl });

      const downloaded = await isDownloaded();
      void localSetup.begin(plan, channel());

      if (downloaded) {
        try {
          await untilSwitchable();
          await switchToLocal();
          return { direct: true };
        } catch (err) {
          // Better online with the bar explaining than stuck in setup.
          logShell(
            "error",
            "[local-setup] could not open Local directly:",
            err,
          );
        }
      }

      // Shown from now on, not only from the next progress event.
      updateBar();
      return { direct: false };
    },
  );

  ipcMain.handle("local-setup:retry", () => {
    void localSetup.retry();
  });

  ipcMain.handle("local-setup:switch", () => switchToLocal());

  ipcMain.handle("setup-bar:dismiss", () => {
    dismissed = true;
    announceReady = false;
    updateBar();
  });

  /** "Not now" on the ready dialog: back to the card. */
  ipcMain.handle("setup-bar:later", () => {
    announceReady = false;
    updateBar();
  });
}
