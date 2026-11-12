import { BrowserWindow, type WebContents } from "electron";

import { cloudSessionCookie } from "../cloud/auth";
import { graphql } from "../cloud/connection";
import { store } from "../settings/store";
import { logShell } from "../shell/log";
import { isAllowedAppUrl, isShellPage } from "../shell/origins";
import { getMainWindow, onMainWindowCreated } from "../shell/windows";
import { type VirtualScreen, getVirtualScreens } from "./config";
import {
  type ClickerKey,
  type InputReader,
  canGrab,
  isLetter,
  keyFor,
  listInputDevices,
  openNode,
} from "./evdev";
import { hostLabel, sourceBase } from "./sources";
import { servedFrom } from "./windows";

/** A presentation clicker moving the slides of one virtual screen. */

export type ClickerConfig = {
  enabled: boolean;
  device?: { id: string; name: string };
  /** The open project, or a virtual screen (the default). */
  target?: "screen" | "project";
  /** The virtual screen it controls. */
  screenId?: string;
};

/** What a press moves right now. */
export type ClickerTarget =
  | { kind: "project" }
  | { kind: "screen"; screen: VirtualScreen }
  | null;

export type ClickerState = "off" | "no-device" | "waiting" | "listening" | "denied";

export type ClickerStatus =
  | { supported: false; reason: string }
  | {
      supported: true;
      config: ClickerConfig;
      /** "project", a virtual screen's id, or null when it needs choosing. */
      target: string | null;
      /** The project open in the app window, by name. */
      openProject: { name: string | null } | null;
      state: ClickerState;
      /** Its presses don't also reach the focused window. */
      grabbed: boolean;
      testing: boolean;
      /** Why it was turned off by itself, until it is set up again. */
      notice: string | null;
    };

const KEY = "clicker";
const RETRY_MS = 3000;
const RESCAN_MS = 1000;

const supported = () => process.platform === "linux";

export function getClickerConfig(): ClickerConfig {
  return store.get<ClickerConfig>(KEY) ?? { enabled: false };
}

/**
 * What it moves. A choice that no longer exists stays unanswered rather than
 * moving something else; with no choice made, the only screen, or the open
 * project when there are none.
 */
export function clickerTarget(
  config: ClickerConfig,
  screens: VirtualScreen[],
): ClickerTarget {
  if (config.target === "project") return { kind: "project" };
  if (config.target === "screen" || config.screenId) {
    const screen = screens.find((s) => s.id === config.screenId);
    return screen ? { kind: "screen", screen } : null;
  }
  if (screens.length === 1) return { kind: "screen", screen: screens[0]! };
  return screens.length === 0 ? { kind: "project" } : null;
}

const drivesProject = () =>
  supported() &&
  getClickerConfig().enabled &&
  clickerTarget(getClickerConfig(), getVirtualScreens())?.kind === "project";

// -- The project open in the app window ----------------------------------------

/** A project page, as its URL names it: `<base>/app/<org>/<project>`. */
export type ProjectPage = { base: string; orgSlug: string; projectSlug: string };

export function projectFromUrl(url: string): ProjectPage | null {
  const m = url.match(/^(https?:\/\/.*?)\/app\/([^/?#]+)\/([^/?#]+)/);
  if (!m) return null;
  try {
    return {
      base: m[1]!,
      orgSlug: decodeURIComponent(m[2]!),
      projectSlug: decodeURIComponent(m[3]!),
    };
  } catch {
    return null;
  }
}

const pageKey = (p: ProjectPage) => `${p.base}/${p.orgSlug}/${p.projectSlug}`;

let openPage: ProjectPage | null = null;
let resolved: { key: string; projectId: string; name: string } | null = null;

function onAppNavigate(url: string): void {
  const page = isAllowedAppUrl(url) ? projectFromUrl(url) : null;
  if ((page && pageKey(page)) === (openPage && pageKey(openPage))) return;
  openPage = page;
  resolved = null;
  changed();
  // For its name in the panel; a press resolves it again if this fails.
  if (page && drivesProject()) void resolveOpenProject().catch(() => {});
}

function watchAppWindow(win: Electron.BrowserWindow): void {
  const follow = () => {
    if (!win.isDestroyed()) onAppNavigate(win.webContents.getURL());
  };
  win.webContents.on("did-navigate", follow);
  win.webContents.on("did-navigate-in-page", follow);
  win.on("closed", () => onAppNavigate(""));
  follow();
}

async function resolveOpenProject(): Promise<{
  base: string;
  projectId: string;
  name: string;
}> {
  const page = openPage;
  if (!page) throw new Error("No project is open in TheOpenPresenter.");
  const key = pageKey(page);
  if (resolved?.key !== key) {
    const data = await graphql<{
      organizationBySlug: {
        projects: { nodes: { id: string; name: string }[] };
      } | null;
    }>(
      page.base,
      "query ClickerProject($org: String!, $slug: String!) { organizationBySlug(slug: $org) { projects(condition: { slug: $slug }) { nodes { id name } } } }",
      { org: page.orgSlug, slug: page.projectSlug },
    );
    const project = data.organizationBySlug?.projects.nodes[0];
    if (!project) throw new Error("Couldn't find the open project.");
    // Still the same page once the answer is back.
    if (openPage && pageKey(openPage) === key) {
      resolved = { key, projectId: project.id, name: project.name };
      changed();
    }
    return { base: page.base, projectId: project.id, name: project.name };
  }
  return { base: page.base, projectId: resolved.projectId, name: resolved.name };
}

function broadcast(channel: string, payload?: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed() && isShellPage(win.webContents.getURL())) {
      win.webContents.send(channel, payload);
    }
  }
}

// -- Listening -----------------------------------------------------------------

/** Open nodes of the chosen clicker, by path. */
type Node = { reader: InputReader; grabbed: boolean; warned: boolean };
const nodes = new Map<string, Node>();
let state: ClickerState = "off";
let retryTimer: NodeJS.Timeout | null = null;
let test: { stop: () => void } | null = null;
let notice: string | null = null;

export function clickerStatus(): ClickerStatus {
  if (!supported()) {
    return {
      supported: false,
      reason:
        process.platform === "win32"
          ? "Clickers aren't supported on Windows yet."
          : "Clickers aren't supported on macOS yet.",
    };
  }
  const config = getClickerConfig();
  const target = clickerTarget(config, getVirtualScreens());
  return {
    supported: true,
    config,
    target:
      target?.kind === "screen" ? target.screen.id : (target?.kind ?? null),
    openProject: openPage && {
      name: resolved?.name ?? openPage.projectSlug,
    },
    state,
    grabbed:
      nodes.size > 0 && [...nodes.values()].every((s) => s.grabbed),
    testing: test !== null,
    notice,
  };
}

let lastSent = "";

/** Tell the panel, only when something it shows changed. */
function changed(): void {
  const status = JSON.stringify(clickerStatus());
  if (status === lastSent) return;
  lastSent = status;
  broadcast("clicker:changed");
}

function setState(next: ClickerState): void {
  state = next;
  changed();
}

function stopLive(): void {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  const open = [...nodes.values()];
  // Cleared first, so their close handlers know it was on purpose.
  nodes.clear();
  for (const s of open) s.reader.close();
  // Letters belong to the device that typed them.
  letters.clear();
}

async function grabNode(path: string, node: Node): Promise<void> {
  const why = await node.reader.grab();
  node.grabbed = why === null;
  if (why === null) {
    if (node.warned) logShell("info", `[clicker] grabbed ${path} after all`);
    node.warned = false;
  } else if (!node.warned) {
    // Once: it is tried again every few seconds.
    node.warned = true;
    logShell("warn", `[clicker] can't grab ${path}, presses may leak:`, why);
  }
}

function retry(): void {
  retryTimer ??= setTimeout(() => {
    retryTimer = null;
    void refresh();
  }, RETRY_MS);
}

let refreshing: Promise<void> = Promise.resolve();

/** Open the chosen clicker, or wait for it to be plugged in. */
function refresh(): Promise<void> {
  refreshing = refreshing
    .then(async () => {
      if (!supported() || test) return;
      const config = getClickerConfig();
      if (!config.enabled) return setState("off");
      if (!config.device) return setState("no-device");

      const id = config.device.id;
      const device = (await listInputDevices()).find((d) => d.id === id);
      if (test) return;
      if (!device) {
        stopLive();
        retry();
        return setState("waiting");
      }

      let denied = false;
      const grabbable = canGrab();
      const grabbing: Promise<void>[] = [];
      for (const path of device.paths) {
        const known = nodes.get(path);
        if (known) {
          // Something else may have held it, and let go since.
          if (!known.grabbed && grabbable) grabbing.push(grabNode(path, known));
          continue;
        }
        let reader: InputReader | null = null;
        const opened = openNode(
          path,
          (code) => {
            const key = keyFor(code);
            if (key) void press(key);
            else if (isLetter(code)) typed(code, device.name);
          },
          () => {
            if (!reader || nodes.get(path)?.reader !== reader) return;
            nodes.delete(path);
            logShell("info", `[clicker] ${path} closed`);
            void refresh();
          },
        );
        if (!opened.ok) {
          denied ||= opened.denied;
          continue;
        }
        reader = opened.reader;
        const node: Node = { reader, grabbed: false, warned: false };
        nodes.set(path, node);
        logShell("info", `[clicker] listening on ${path} (${device.name})`);
        if (grabbable) grabbing.push(grabNode(path, node));
        else if (!node.warned) {
          node.warned = true;
          logShell("warn", "[clicker] no runtime manager to grab with");
        }
      }
      await Promise.all(grabbing);
      const ungrabbed =
        grabbable && [...nodes.values()].some((n) => !n.grabbed);
      if (nodes.size < device.paths.length || ungrabbed) retry();
      setState(
        nodes.size > 0 ? "listening" : denied ? "denied" : "waiting",
      );
    })
    .catch((err) => logShell("error", "[clicker] could not open:", err));
  return refreshing;
}

/** Letters typed lately on the captured device, by key code. */
const letters = new Map<number, number>();
const TYPING_LETTERS = 3;
const TYPING_MS = 10_000;

/**
 * A clicker sends the odd letter (B blanks the screen); several different
 * ones means a keyboard is captured, so give it back.
 */
function typed(code: number, name: string): void {
  const now = Date.now();
  letters.set(code, now);
  for (const [c, at] of letters) if (now - at > TYPING_MS) letters.delete(c);
  if (letters.size < TYPING_LETTERS) return;
  letters.clear();
  logShell("warn", `[clicker] ${name} is typing letters, releasing it`);
  saveClickerConfig({ enabled: false });
  notice = `Turned off: ${name} was typing letters, so it looks like a keyboard. Find your clicker again to choose a different device.`;
  changed();
}

// -- Sending -------------------------------------------------------------------

export type ClickerPress = {
  key: ClickerKey;
  ok: boolean;
  /** What went wrong, or which screen moved. */
  message: string;
};

const screenUuids = new Map<string, string>();

async function signedIn(base: string): Promise<void> {
  if (!(await cloudSessionCookie(base))) {
    throw new Error(`Sign in to ${hostLabel(base)} first.`);
  }
}

/** The server answers null, not an error, when there was nothing to move. */
function moved(payload: { success: boolean } | null): void {
  if (!payload?.success) {
    throw new Error("Nothing moved. Is a slide showing?");
  }
}

async function screenUuid(
  base: string,
  orgSlug: string,
  screenSlug: string,
): Promise<string> {
  const key = `${base}/${orgSlug}/${screenSlug}`;
  const cached = screenUuids.get(key);
  if (cached) return cached;
  const data = await graphql<{
    organizationBySlug: {
      screens: { nodes: { id: string; slug: string }[] };
    } | null;
  }>(
    base,
    "query ClickerScreen($slug: String!) { organizationBySlug(slug: $slug) { screens { nodes { id slug } } } }",
    { slug: orgSlug },
  );
  const id = data.organizationBySlug?.screens.nodes.find(
    (s) => s.slug === screenSlug,
  )?.id;
  if (!id) throw new Error("That virtual screen no longer exists.");
  screenUuids.set(key, id);
  return id;
}

async function pressProject(key: ClickerKey): Promise<string> {
  if (openPage) await signedIn(openPage.base);
  const project = await resolveOpenProject();
  const data = await graphql<{
    pluginKeyPress: { success: boolean } | null;
  }>(
    project.base,
    "mutation PluginKeyPress($input: PluginKeyPressInput!) { pluginKeyPress(input: $input) { success } }",
    {
      input: {
        keyType: key,
        projectId: project.projectId,
        // The page's default output.
        rendererId: "1",
      },
    },
  );
  moved(data.pluginKeyPress);
  return project.name;
}

async function sendPress(key: ClickerKey): Promise<string> {
  const target = clickerTarget(getClickerConfig(), getVirtualScreens());
  if (!target) throw new Error("Choose what it controls.");
  if (target.kind === "project") return pressProject(key);
  const vs = target.screen;
  // Where the screen is showing from, which may be this computer's copy.
  const where = servedFrom(vs.id) ?? {
    base: sourceBase(vs.source),
    orgSlug: vs.orgSlug,
  };
  if (!where.base) throw new Error("This computer's server isn't running.");
  await signedIn(where.base);

  const screenId = await screenUuid(where.base, where.orgSlug, vs.screenSlug);
  let data: { screenKeyPress: { success: boolean } | null };
  try {
    data = await graphql(
      where.base,
      "mutation ScreenKeyPress($input: ScreenKeyPressInput!) { screenKeyPress(input: $input) { success } }",
      { input: { keyType: key, screenId } },
    );
  } catch (err) {
    // A screen deleted and remade under the same slug has a new id.
    screenUuids.clear();
    throw err;
  }
  moved(data.screenKeyPress);
  return vs.screenName || vs.screenSlug;
}

async function press(key: ClickerKey): Promise<void> {
  let result: ClickerPress;
  try {
    result = { key, ok: true, message: await sendPress(key) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logShell("warn", `[clicker] ${key} failed:`, message);
    result = { key, ok: false, message };
  }
  broadcast("clicker:press", result);
}

// -- Finding the clicker ---------------------------------------------------------

export type TestPress = { device: { id: string; name: string }; key: ClickerKey };

export type TestResult = { devices: number; opened: number; denied: boolean };

/**
 * Listen to every keyboard-like device, without grabbing, and tell `owner`
 * which one sent a previous or next key. Live presses pause meanwhile.
 */
export async function startClickerTest(owner: WebContents): Promise<TestResult> {
  stopClickerTest();
  // Set up front: a start that overlaps another must close its own readers.
  const opened = new Map<string, InputReader>();
  let stopped = false;
  let denied = false;

  // Again every so often: the clicker may be plugged in after this starts.
  const scan = async () => {
    const devices = await listInputDevices();
    if (stopped) return devices;
    for (const device of devices) {
      for (const path of device.paths) {
        if (opened.has(path)) continue;
        const result = openNode(
          path,
          (code) => {
            const key = keyFor(code);
            if (key && !owner.isDestroyed()) {
              const payload: TestPress = {
                device: { id: device.id, name: device.name },
                key,
              };
              owner.send("clicker:test-press", payload);
            }
          },
          () => opened.delete(path),
        );
        if (result.ok) opened.set(path, result.reader);
        else denied ||= result.denied;
      }
    }
    return devices;
  };

  const timer = setInterval(() => void scan(), RESCAN_MS);
  // Closed, reloaded or crashed: its page can't stop this any more.
  const onGone = () => {
    if (test === session) stopClickerTest();
  };
  const onNavigate = (details: Electron.Event<Electron.WebContentsDidStartNavigationEventParams>) => {
    if (details.isMainFrame && !details.isSameDocument) onGone();
  };
  owner.once("destroyed", onGone);
  owner.on("render-process-gone", onGone);
  owner.on("did-start-navigation", onNavigate);
  const session = {
    stop: () => {
      stopped = true;
      clearInterval(timer);
      if (!owner.isDestroyed()) {
        owner.removeListener("destroyed", onGone);
        owner.removeListener("render-process-gone", onGone);
        owner.removeListener("did-start-navigation", onNavigate);
      }
      for (const r of opened.values()) r.close();
      opened.clear();
    },
  };
  test = session;
  changed();

  // A refresh under way sees `test` and leaves the clicker alone.
  await refreshing;
  if (test !== session) return { devices: 0, opened: 0, denied: false };
  stopLive();
  const devices = await scan();
  return { devices: devices.length, opened: opened.size, denied };
}

export function stopClickerTest(): void {
  if (!test) return;
  test.stop();
  test = null;
  void refresh();
}

// -- Setup ---------------------------------------------------------------------

export function saveClickerConfig(patch: Partial<ClickerConfig>): ClickerConfig {
  const before = getClickerConfig();
  const next = { ...before, ...patch };
  store.set(KEY, next);
  if (before.device?.id !== next.device?.id || !next.enabled) stopLive();
  if (patch.enabled || patch.device) notice = null;
  if (openPage && drivesProject()) void resolveOpenProject().catch(() => {});
  void refresh();
  changed();
  return next;
}

export function startClicker(): void {
  if (!supported()) return;
  const win = getMainWindow();
  if (win) watchAppWindow(win);
  onMainWindowCreated(watchAppWindow);
  void refresh();
}
