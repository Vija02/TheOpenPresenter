import { type BrowserWindow, WebContentsView, ipcMain } from "electron";

import { logShell } from "./log";
import {
  baseWebPreferences,
  getMainWindow,
  loadShellUI,
  onMainWindowCreated,
} from "./windows";

/**
 * A card in the bottom-right of the app window, showing the offline setup or
 * organizations being copied. A view laid over the page rather than part of
 * it: the page belongs to whichever server is open, and cannot be asked to
 * make room. For news worth stopping for, it covers the whole window instead
 * and shows a dialog.
 */

export type SetupBarLayout = "hidden" | "card" | "cover";

/** Until the page reports its own height, and never less. */
const MIN_HEIGHT = 44;
const MAX_HEIGHT = 160;
let barHeight = MIN_HEIGHT;
/** Transparent room around the bar for its shadow. */
const GUTTER = 8;
/** Gap between the bar and the window's bottom and right edges. */
const LIFT = 8;
const MAX_WIDTH = 480;

let view: WebContentsView | null = null;
let attachedTo: BrowserWindow | null = null;
let wanted: SetupBarLayout = "hidden";

function layout(): void {
  if (!view || !attachedTo || attachedTo.isDestroyed()) return;
  const { width, height } = attachedTo.getContentBounds();
  if (wanted === "cover") {
    view.setBounds({ x: 0, y: 0, width, height });
    return;
  }
  const viewWidth = Math.min(width, MAX_WIDTH + GUTTER * 2);
  const viewHeight = barHeight + GUTTER * 2;
  view.setBounds({
    x: Math.max(0, width - viewWidth - LIFT),
    y: Math.max(0, height - viewHeight - LIFT),
    width: viewWidth,
    height: viewHeight,
  });
}

/** Above the page again: a page load can end up drawn over the bar. */
function raise(): void {
  if (!view || !attachedTo || attachedTo.isDestroyed()) return;
  attachedTo.contentView.removeChildView(view);
  attachedTo.contentView.addChildView(view);
  layout();
}

const RELAYOUT_ON = [
  "resize",
  "show",
  "maximize",
  "unmaximize",
  "enter-full-screen",
  "leave-full-screen",
] as const;

function detach(): void {
  if (view && attachedTo && !attachedTo.isDestroyed()) {
    attachedTo.contentView.removeChildView(view);
    for (const event of RELAYOUT_ON) attachedTo.off(event as "resize", layout);
    attachedTo.webContents.off("did-finish-load", raise);
  }
  attachedTo = null;
}

function attach(win: BrowserWindow): void {
  if (attachedTo === win) return;
  detach();

  if (!view || view.webContents.isDestroyed()) {
    view = new WebContentsView({ webPreferences: baseWebPreferences() });
    view.setBackgroundColor("#00000000");
    // Only ever the shell's own page.
    view.webContents.on("will-navigate", (event) => event.preventDefault());
    view.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    loadShellUI(view.webContents, "setupbar");
  }

  win.contentView.addChildView(view);
  for (const event of RELAYOUT_ON) win.on(event as "resize", layout);
  win.webContents.on("did-finish-load", raise);
  win.once("closed", () => {
    if (attachedTo === win) attachedTo = null;
  });
  attachedTo = win;
  layout();
}

/** Decides how the bar shows; set by whoever owns its content. */
let rule: () => SetupBarLayout = () => "hidden";

export function setSetupBarRule(decide: () => SetupBarLayout): void {
  rule = decide;
}

/** Apply the rule again, after something it depends on changed. */
export function refreshSetupBar(): void {
  setSetupBarLayout(rule());
}

function setSetupBarLayout(next: SetupBarLayout): void {
  const covering = next === "cover" && wanted !== "cover";
  wanted = next;
  const win = getMainWindow();
  try {
    if (next !== "hidden" && win && !win.isDestroyed()) {
      attach(win);
      layout();
      // So the dialog takes the keyboard, Escape included.
      if (covering) view?.webContents.focus();
    } else {
      detach();
    }
  } catch (err) {
    logShell("error", "[setup-bar] could not update:", err);
  }
}

// The card wraps its text, so it says how tall it is.
ipcMain.handle("setup-bar:height", (event, height: number) => {
  if (!view || event.sender !== view.webContents) return;
  barHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.ceil(height)));
  layout();
});

// A main window made after the bar was asked for gets it too.
onMainWindowCreated((win) => {
  if (wanted !== "hidden") attach(win);
});
