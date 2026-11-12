import { BrowserWindow, net, screen } from "electron";

import { allOrganizations } from "../cloud/connection";
import { runtime } from "../runtime/client";
import { logShell } from "../shell/log";
import { isShellPage } from "../shell/origins";
import {
  createOutputWindow,
  loadShellUI,
  showFullScreenOn,
} from "../shell/windows";
import {
  type VirtualScreen,
  assignDisplays,
  getVirtualScreens,
  screenUrl,
  trimHost,
} from "./config";
import { hostLabel, listScreens } from "./sources";

export type ScreenState =
  | "closed"
  | "open"
  | "waiting-display"
  | "waiting-server"
  | "waiting-network"
  | "failed";

const RETRY_MS = 3000;
const MAX_RETRY_MS = 30_000;
const REACH_TIMEOUT_MS = 5000;

/** Screens the user wants up, whether or not they can be shown yet. */
const wanted = new Set<string>();
const wins = new Map<string, BrowserWindow>();
/** The screen URL each window should be showing. */
const targets = new Map<string, string>();
const states = new Map<string, ScreenState>();

/** Tell Studio's own windows to redraw their screens. */
function notify(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed() && isShellPage(win.webContents.getURL())) {
      win.webContents.send("screens:changed");
    }
  }
}

function setState(id: string, state: ScreenState): void {
  if (states.get(id) === state) return;
  states.set(id, state);
  notify();
}

function dropWindow(id: string): void {
  const win = wins.get(id);
  wins.delete(id);
  targets.delete(id);
  if (win && !win.isDestroyed()) win.destroy();
}

// -- Retrying ------------------------------------------------------------------

/** Failed attempts in a row, per screen, so each backs off on its own. */
const attempts = new Map<string, number>();
let retryTimer: NodeJS.Timeout | null = null;
let retryAt = 0;

/** Run another pass later, sooner if any screen needs it sooner. */
function retryLater(key: string): void {
  const n = attempts.get(key) ?? 0;
  attempts.set(key, n + 1);
  const delay = Math.min(RETRY_MS * 2 ** n, MAX_RETRY_MS);
  const at = Date.now() + delay;
  if (retryTimer) {
    if (retryAt <= at) return;
    clearTimeout(retryTimer);
  }
  retryAt = at;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void syncAll();
  }, delay);
}

function settled(key: string): void {
  attempts.delete(key);
}

let startingLocal: Promise<unknown> | null = null;

/** A local screen needs the local server. A failed start waits for a retry. */
function ensureLocalRuntime(): void {
  if (runtime.url || startingLocal) return;
  startingLocal = runtime
    .startRuntime()
    .catch((err) =>
      logShell("error", "[screens] could not start the local server:", err),
    )
    .finally(() => {
      startingLocal = null;
      // A reused server never says "listening", so place screens now.
      if (runtime.url) void syncAll();
      else retryLater("local-server");
    });
}

// -- Where a screen is served from -----------------------------------------------

type Target =
  | { url: string }
  | { wait: "waiting-server" | "waiting-network" | "failed"; message: string };

type LocalCopies = Map<string, { slug: string; screens: Set<string> }>;

/** What one pass knows, so each screen does not ask again. */
type Pass = {
  /** Local copies of organizations: cloud host + slug → local slug. */
  localCopies: () => Promise<LocalCopies>;
  reachable: Map<string, Promise<boolean>>;
};

function newPass(): Pass {
  let copies: Promise<LocalCopies> | null = null;
  return {
    // Only asked for once a remote screen is placed.
    localCopies: () => (copies ??= localCopies()),
    reachable: new Map(),
  };
}

async function localCopies(): Promise<LocalCopies> {
  const copies: LocalCopies = new Map();
  const base = runtime.url;
  if (!base) return copies;
  try {
    const [orgs, screens] = await Promise.all([
      allOrganizations(base),
      listScreens({ kind: "local" }),
    ]);
    for (const org of orgs) {
      if (!org.cloudHost || !org.cloudOrganizationSlug) continue;
      const local = screens.find((s) => s.slug === org.slug);
      copies.set(`${trimHost(org.cloudHost)}/${org.cloudOrganizationSlug}`, {
        slug: org.slug,
        screens: new Set(local?.screens.map((s) => s.slug) ?? []),
      });
    }
  } catch (err) {
    logShell("warn", "[screens] could not list local copies:", err);
  }
  return copies;
}

async function isReachable(host: string): Promise<boolean> {
  try {
    await net.fetch(host, {
      method: "HEAD",
      signal: AbortSignal.timeout(REACH_TIMEOUT_MS),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * This computer's copy when it has one: it keeps showing without the
 * internet. Otherwise the server, once it can be reached.
 */
async function resolveTarget(vs: VirtualScreen, pass: Pass): Promise<Target> {
  if (vs.source.kind === "local") {
    if (!runtime.url) {
      ensureLocalRuntime();
      return {
        wait: "waiting-server",
        message: "Starting this computer's server…",
      };
    }
    return { url: screenUrl(runtime.url, vs) };
  }

  const host = trimHost(vs.source.host);
  const copy = (await pass.localCopies()).get(`${host}/${vs.orgSlug}`);
  if (runtime.url && copy?.screens.has(vs.screenSlug)) {
    return { url: screenUrl(runtime.url, { ...vs, orgSlug: copy.slug }) };
  }

  // Showing already: the page reconnects by itself through a blip.
  const url = screenUrl(host, vs);
  if (targets.get(vs.id) === url) return { url };

  let reach = pass.reachable.get(host);
  if (!reach) {
    reach = isReachable(host);
    pass.reachable.set(host, reach);
  }
  if (!(await reach)) {
    return {
      wait: "waiting-network",
      message: `Waiting for ${hostLabel(host)}…`,
    };
  }
  return { url };
}

// -- Windows -------------------------------------------------------------------

function samePage(a: string, b: string): boolean {
  try {
    const x = new URL(a);
    const y = new URL(b);
    return x.origin === y.origin && x.pathname === y.pathname;
  } catch {
    return false;
  }
}

function showStatus(win: BrowserWindow, message: string): void {
  loadShellUI(win, "screenstatus", encodeURIComponent(message));
}

function createScreenWindow(
  vs: VirtualScreen,
  display: Electron.Display,
): BrowserWindow {
  const id = vs.id;
  const win = createOutputWindow(
    display,
    vs.screenName
      ? `${vs.screenName} — TheOpenPresenter`
      : "TheOpenPresenter Screen",
    () => closeScreen(id),
  );
  const current = () => !win.isDestroyed() && wins.get(id) === win;

  const failed = (why: string) => {
    if (!current()) return;
    logShell("warn", `[screens] ${vs.screenSlug} ${why}, retrying`);
    setState(id, "failed");
    // A fresh pass: the server may have changed, or a local copy appeared.
    targets.delete(id);
    showStatus(win, "Couldn't load this screen. Trying again…");
    retryLater(id);
  };
  // A sign-in or error page the server sent us to instead.
  const elsewhere = (url: string) => {
    const target = targets.get(id);
    return !!target && !url.startsWith("file:") && !samePage(url, target);
  };

  win.webContents.on(
    "did-fail-load",
    (_event, code, description, _url, isMainFrame) => {
      // -3 is ERR_ABORTED: a navigation we replaced ourselves.
      if (!isMainFrame || code === -3) return;
      failed(`failed to load (${code} ${description})`);
    },
  );
  win.webContents.on("did-navigate", (_event, url, httpResponseCode) => {
    if (elsewhere(url)) failed(`was sent to ${url}`);
    else if (httpResponseCode >= 400 && url === targets.get(id)) {
      failed(`got ${httpResponseCode}`);
    }
  });
  win.webContents.on("did-finish-load", () => {
    const url = win.webContents.getURL();
    if (!current() || !targets.has(id) || url.startsWith("file:")) return;
    if (elsewhere(url)) return failed(`was sent to ${url}`);
    setState(id, "open");
    settled(id);
  });
  win.webContents.on("render-process-gone", (_event, details) => {
    failed(`crashed (${details.reason})`);
  });

  win.on("closed", () => {
    if (wins.get(id) !== win) return;
    wins.delete(id);
    targets.delete(id);
    wanted.delete(id);
    setState(id, "closed");
  });

  wins.set(id, win);
  return win;
}

async function sync(
  vs: VirtualScreen,
  display: Electron.Display | null,
  target: Target | null,
  focus: boolean,
): Promise<void> {
  if (!wanted.has(vs.id)) {
    dropWindow(vs.id);
    setState(vs.id, "closed");
    return;
  }
  if (!display) {
    dropWindow(vs.id);
    setState(vs.id, "waiting-display");
    return;
  }
  // Closed and reopened while we were looking: the next pass has it.
  if (!target) return;

  let win = wins.get(vs.id);
  if (!win || win.isDestroyed()) win = createScreenWindow(vs, display);

  if ("wait" in target) {
    if (targets.has(vs.id) || states.get(vs.id) !== target.wait) {
      targets.delete(vs.id);
      showStatus(win, target.message);
    }
    setState(vs.id, target.wait);
    retryLater(vs.id);
  } else if (targets.get(vs.id) !== target.url) {
    targets.set(vs.id, target.url);
    win.loadURL(target.url).catch(() => {});
  }

  await showFullScreenOn(win, display, focus);
}

let syncing: Promise<void> = Promise.resolve();

/** Bring every window in line with config, displays and servers. */
export function syncAll(focusId?: string): Promise<void> {
  // Serialised: two passes moving the same window fight each other. A failed
  // pass must not stop the ones after it.
  syncing = syncing
    .catch(() => {})
    .then(async () => {
      const screens = getVirtualScreens();
      const known = new Set(screens.map((s) => s.id));
      for (const id of [...wins.keys()]) {
        if (!known.has(id)) dropWindow(id);
      }
      for (const id of [...wanted]) if (!known.has(id)) wanted.delete(id);

      const placed = assignDisplays(
        screens,
        screen.getAllDisplays(),
        screen.getPrimaryDisplay(),
      );
      // Looked up together, so one unreachable server doesn't hold up the rest.
      const pass = newPass();
      const resolved = await Promise.all(
        screens.map((vs) =>
          wanted.has(vs.id) && placed.get(vs.id)
            ? resolveTarget(vs, pass).catch((err): Target => {
                logShell("error", `[screens] ${vs.screenSlug}:`, err);
                return {
                  wait: "failed",
                  message: "Couldn't load this screen. Trying again…",
                };
              })
            : null,
        ),
      );
      for (const [i, vs] of screens.entries()) {
        try {
          await sync(
            vs,
            placed.get(vs.id) ?? null,
            resolved[i]!,
            vs.id === focusId,
          );
        } catch (err) {
          logShell("error", `[screens] could not show ${vs.screenSlug}:`, err);
        }
      }
      // Displays may have changed under an open settings panel.
      notify();
    });
  return syncing;
}

export function openScreen(id: string): Promise<void> {
  wanted.add(id);
  settled(id);
  return syncAll(id);
}

export function closeScreen(id: string): void {
  wanted.delete(id);
  settled(id);
  dropWindow(id);
  setState(id, "closed");
}

export function openAllScreens(): Promise<void> {
  for (const vs of getVirtualScreens()) wanted.add(vs.id);
  return syncAll();
}

export function closeAllScreens(): void {
  for (const id of [...wanted, ...wins.keys()]) closeScreen(id);
}

export function openScreensOnLaunch(): Promise<void> {
  for (const vs of getVirtualScreens()) {
    if (vs.openOnLaunch) wanted.add(vs.id);
  }
  return syncAll();
}

export function screenState(id: string): ScreenState {
  return states.get(id) ?? "closed";
}

/** The server and organization an open screen is loaded from: maybe a local copy. */
export function servedFrom(id: string): { base: string; orgSlug: string } | null {
  const m = targets.get(id)?.match(/^(.*)\/render\/s\/([^/]+)\/[^/]+$/);
  return m ? { base: m[1]!, orgSlug: decodeURIComponent(m[2]!) } : null;
}

/** Local screens waiting on the server go up as soon as it listens. */
export function watchLocalServer(): void {
  runtime.on("listening", () => {
    attempts.clear();
    void syncAll();
  });
}
