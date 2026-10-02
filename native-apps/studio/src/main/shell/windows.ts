import { BrowserWindow, app, globalShortcut, screen, shell } from "electron";
import { join } from "path";

import { openExternalSafely } from "./external";
import { isAllowedAppUrl } from "./origins";

const PRELOAD_PATH = join(__dirname, "../preload/index.js");
const RENDERER_URL = process.env["ELECTRON_RENDERER_URL"];

export const ICON_PATH = app.isPackaged
  ? join(process.resourcesPath, "icon.png")
  : join(__dirname, "../../packaging/icon.png");

let mainWin: BrowserWindow | null = null;
/** Presentation windows, keyed by renderer id so each output is addressable. */
const presentWins = new Map<string, BrowserWindow>();

export function getMainWindow(): BrowserWindow | null {
  return mainWin;
}

/**
 * Stop a window navigating itself somewhere we did not sanction
 */
function guardNavigation(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    void openExternalSafely(url).catch(() => {});
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    if (isAllowedAppUrl(url)) return;
    event.preventDefault();
    console.warn(`[shell] blocked navigation to ${url}`);
    void openExternalSafely(url).catch(() => {});
  });

  // A webview would get its own renderer with our preload attached.
  win.webContents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });
}

function baseWebPreferences() {
  return {
    preload: PRELOAD_PATH,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webviewTag: false,
    webSecurity: true,
    allowRunningInsecureContent: false,
    backgroundThrottling: false,
    autoplayPolicy: "no-user-gesture-required" as const,
  };
}

/**
 * The window the app itself runs in. Created hidden and shown only once it has
 * something real to display, so nobody watches an empty frame during startup.
 */
export function createMainWindow(): BrowserWindow {
  mainWin = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: "#111111",
    title: "TheOpenPresenter",
    icon: ICON_PATH,
    webPreferences: baseWebPreferences(),
  });
  guardNavigation(mainWin);

  mainWin.on("closed", () => {
    mainWin = null;
  });

  return mainWin;
}

/**
 * Load one of the shell's own React entry points
 */
export function loadShellUI(
  win: BrowserWindow,
  entry: "onboarding" | "panel" | "loading" | "unreachable",
  panel?: string,
): void {
  const hash = panel ? `#${panel}` : "";
  if (RENDERER_URL) {
    win.loadURL(`${RENDERER_URL}/${entry}.html${hash}`);
  } else {
    win.loadFile(join(__dirname, `../renderer/${entry}.html`), {
      hash: panel,
    });
  }
}

export function appEntryUrl(url: string, organizationSlug?: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.pathname === "/" && !parsed.search && !parsed.hash) {
      parsed.pathname = organizationSlug
        ? `/o/${encodeURIComponent(organizationSlug)}`
        : "/o";
      return parsed.toString();
    }
  } catch {
    // Not parseable. Return it as given and let the window report it.
  }
  return url;
}

/** Point the main window at a server, replacing the shell's own UI. */
export function navigateToServer(url: string): void {
  const target = appEntryUrl(url);
  if (!isAllowedAppUrl(target)) {
    console.error(`[shell] refused to navigate to ${target}`);
    return;
  }
  if (!mainWin || mainWin.isDestroyed()) createMainWindow();
  mainWin!.loadURL(target).catch((err) => {
    console.error("[windows] failed to load", target, err);
  });
}

/**
 * Go back to setup. Hides the app window rather than navigating it, so
 * whatever was on screen survives.
 */
export function backToShellUI(): void {
  closePanelWindow();
  openOnboardingWindow();
  if (mainWin && !mainWin.isDestroyed()) mainWin.hide();
}

/**
 * The settings window.
 */
let panelWin: BrowserWindow | null = null;

export function openPanelWindow(section?: string): BrowserWindow {
  if (panelWin && !panelWin.isDestroyed()) {
    panelWin.focus();
    if (section) {
      void panelWin.webContents
        .executeJavaScript(`window.location.hash = ${JSON.stringify(section)}`)
        .catch(() => {
          // The page may not have finished loading yet, in which case it will
          // read the hash it was opened with anyway.
        });
    }
    return panelWin;
  }

  panelWin = new BrowserWindow({
    width: 760,
    height: 580,
    minWidth: 620,
    minHeight: 460,
    show: false,
    backgroundColor: "#111111",
    title: "Settings",
    icon: ICON_PATH,
    // A utility window, not a second main window.
    autoHideMenuBar: true,
    parent: mainWin ?? undefined,
    webPreferences: baseWebPreferences(),
  });
  guardNavigation(panelWin);

  loadShellUI(panelWin, "panel", section);
  panelWin.once("ready-to-show", () => panelWin?.show());

  panelWin.on("closed", () => {
    panelWin = null;
  });

  return panelWin;
}

export function closePanelWindow(): void {
  if (panelWin && !panelWin.isDestroyed()) panelWin.close();
  panelWin = null;
}

// -- Loading ----------------------------------------------------------------
let loadingWin: BrowserWindow | null = null;

export function openLoadingWindow(): BrowserWindow {
  if (loadingWin && !loadingWin.isDestroyed()) {
    loadingWin.focus();
    return loadingWin;
  }

  loadingWin = new BrowserWindow({
    width: 420,
    height: 300,
    frame: false,
    resizable: false,
    movable: true,
    show: false,
    backgroundColor: "#111111",
    title: "TheOpenPresenter",
    icon: ICON_PATH,
    skipTaskbar: false,
    webPreferences: baseWebPreferences(),
  });
  guardNavigation(loadingWin);

  loadShellUI(loadingWin, "loading");
  loadingWin.once("ready-to-show", () => loadingWin?.show());
  loadingWin.on("closed", () => {
    loadingWin = null;
  });

  return loadingWin;
}

export function closeLoadingWindow(): void {
  if (loadingWin && !loadingWin.isDestroyed()) loadingWin.destroy();
  loadingWin = null;
}

export function getLoadingWindow(): BrowserWindow | null {
  return loadingWin;
}

// -- Unreachable ------------------------------------------------------------
let unreachableWin: BrowserWindow | null = null;

export function openUnreachableWindow(
  label: string,
  url: string,
): BrowserWindow {
  if (unreachableWin && !unreachableWin.isDestroyed()) {
    unreachableWin.focus();
    return unreachableWin;
  }

  unreachableWin = new BrowserWindow({
    width: 480,
    height: 380,
    resizable: false,
    show: false,
    backgroundColor: "#111111",
    title: "TheOpenPresenter",
    icon: ICON_PATH,
    autoHideMenuBar: true,
    webPreferences: baseWebPreferences(),
  });
  guardNavigation(unreachableWin);

  const params = new URLSearchParams({ label, url });
  loadShellUI(unreachableWin, "unreachable", params.toString());
  unreachableWin.once("ready-to-show", () => unreachableWin?.show());
  unreachableWin.on("closed", () => {
    unreachableWin = null;
  });

  return unreachableWin;
}

export function closeUnreachableWindow(): void {
  if (unreachableWin && !unreachableWin.isDestroyed()) unreachableWin.destroy();
  unreachableWin = null;
}

// -- Onboarding -------------------------------------------------------------
let onboardingWin: BrowserWindow | null = null;

export function openOnboardingWindow(): BrowserWindow {
  if (onboardingWin && !onboardingWin.isDestroyed()) {
    onboardingWin.focus();
    return onboardingWin;
  }

  onboardingWin = new BrowserWindow({
    width: 720,
    height: 640,
    minWidth: 560,
    minHeight: 520,
    show: false,
    backgroundColor: "#111111",
    title: "Welcome to TheOpenPresenter",
    icon: ICON_PATH,
    autoHideMenuBar: true,
    webPreferences: baseWebPreferences(),
  });
  guardNavigation(onboardingWin);

  loadShellUI(onboardingWin, "onboarding");
  onboardingWin.once("ready-to-show", () => onboardingWin?.show());

  onboardingWin.on("closed", () => {
    onboardingWin = null;
  });

  return onboardingWin;
}

export function closeOnboardingWindow(): void {
  if (onboardingWin && !onboardingWin.isDestroyed()) onboardingWin.destroy();
  onboardingWin = null;
}

export function getOnboardingWindow(): BrowserWindow | null {
  return onboardingWin;
}

/**
 * Hand the window over to the running server. The end of every startup path:
 * whatever was showing progress goes away as the app window appears.
 */
export function showAppWindow(url: string, organizationSlug?: string): void {
  const entry = appEntryUrl(url, organizationSlug);
  if (!isAllowedAppUrl(entry)) {
    console.error(`[shell] refused to show ${entry}`);
    return;
  }

  const win = mainWin && !mainWin.isDestroyed() ? mainWin : createMainWindow();

  let revealed = false;
  const reveal = () => {
    if (revealed) return;
    revealed = true;
    win.show();
    win.focus();
    // Only after the app is visible, so the screen is never empty.
    closeLoadingWindow();
    closeOnboardingWindow();
  };

  // `ready-to-show` fires once per window, so on its own it stranded
  // onboarding on "Connecting…" when the main window had already shown during
  // startup. `did-finish-load` fires every load; the guard makes them
  // idempotent.
  win.webContents.once("did-finish-load", reveal);
  win.once("ready-to-show", reveal);

  win.loadURL(entry);
}

// -- Presentation windows ---------------------------------------------------
export type MonitorInfo = {
  id: string;
  name: string;
  width: number;
  height: number;
  x: number;
  y: number;
  isPrimary: boolean;
};

export function listMonitors(): MonitorInfo[] {
  const primary = screen.getPrimaryDisplay();
  return screen.getAllDisplays().map((display) => ({
    id: String(display.id),
    name: display.label || `Display ${display.id}`,
    width: display.bounds.width,
    height: display.bounds.height,
    x: display.bounds.x,
    y: display.bounds.y,
    isPrimary: display.id === primary.id,
  }));
}

function displayForIndex(index: number) {
  const displays = screen.getAllDisplays();
  return displays[index] ?? displays[0];
}

export function openPresentWindow(
  url: string,
  monitorIndex: number,
  rendererId = "1",
): void {
  const display = displayForIndex(monitorIndex);
  if (!display) throw new Error("No displays available");

  let win = presentWins.get(rendererId);

  if (!win || win.isDestroyed()) {
    win = new BrowserWindow({
      frame: false,
      show: false,
      backgroundColor: "#000000",
      title: "TheOpenPresenter Renderer",
      icon: ICON_PATH,
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      webPreferences: baseWebPreferences(),
    });
    guardNavigation(win);
    presentWins.set(rendererId, win);

    win.on("closed", () => {
      presentWins.delete(rendererId);
      mainWin?.webContents.send(
        "present-windows-changed",
        listPresentWindows(),
      );
    });

    // Only while focused: a global Escape would fire while the operator is
    // typing in the main window.
    win.on("focus", () => {
      globalShortcut.register("Escape", () => closePresentWindow(rendererId));
    });
    win.on("blur", () => {
      globalShortcut.unregister("Escape");
    });
  }

  const target = win;
  if (target.webContents.getURL() !== url) {
    target.loadURL(url).catch(() => {});
  }

  target.setBounds(display.bounds);
  target.show();

  // macOS native fullscreen moves the window to its own Space, hiding the
  // operator's main window behind a Space switch every time they present.
  if (process.platform !== "darwin") {
    target.setFullScreen(true);
  } else {
    target.setSimpleFullScreen(true);
  }

  target.focus();
  mainWin?.webContents.send("present-windows-changed", listPresentWindows());
}

export function closePresentWindow(rendererId = "1"): void {
  const win = presentWins.get(rendererId);
  if (win && !win.isDestroyed()) win.close();
  presentWins.delete(rendererId);
  mainWin?.webContents.send("present-windows-changed", listPresentWindows());
}

export function closeAllPresentWindows(): void {
  for (const id of [...presentWins.keys()]) closePresentWindow(id);
}

export function listPresentWindows(): string[] {
  return [...presentWins.keys()];
}

/** Re-apply geometry when displays change under a live presentation. */
export function repositionPresentWindows(): void {
  for (const [, win] of presentWins) {
    if (win.isDestroyed()) continue;
    const display = screen.getDisplayNearestPoint(win.getBounds());
    win.setBounds(display.bounds);
  }
}
