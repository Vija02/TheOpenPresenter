import { type BrowserWindow, WebContentsView } from "electron";

import {
  baseWebPreferences,
  getMainWindow,
  loadShellUI,
} from "../shell/windows";

/**
 * "Disconnected", laid over the whole app window while the joined computer is
 * away. A view rather than part of the page: the page belongs to the computer
 * that's gone.
 */

let view: WebContentsView | null = null;
let attachedTo: BrowserWindow | null = null;

function onWindowClosed(): void {
  attachedTo = null;
  view = null;
}

const RELAYOUT_ON = [
  "resize",
  "show",
  "maximize",
  "unmaximize",
  "enter-full-screen",
  "leave-full-screen",
] as const;

function layout(): void {
  if (!view || !attachedTo || attachedTo.isDestroyed()) return;
  const { width, height } = attachedTo.getContentBounds();
  view.setBounds({ x: 0, y: 0, width, height });
}

/** Above the page again: a page load can end up drawn over it. */
function raise(): void {
  if (!view || !attachedTo || attachedTo.isDestroyed()) return;
  attachedTo.contentView.removeChildView(view);
  attachedTo.contentView.addChildView(view);
  layout();
}

export function isDisconnectedShowing(): boolean {
  return !!attachedTo && !attachedTo.isDestroyed();
}

/** False when there's no app window to lay it over. */
export function showDisconnected(label: string): boolean {
  const win = getMainWindow();
  if (!win || win.isDestroyed()) return false;
  if (attachedTo === win) return true;
  hideDisconnected();

  view = new WebContentsView({ webPreferences: baseWebPreferences() });
  view.setBackgroundColor("#00000000");
  // Only ever the shell's own page.
  view.webContents.on("will-navigate", (event) => event.preventDefault());
  view.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  loadShellUI(
    view.webContents,
    "disconnected",
    new URLSearchParams({ label }).toString(),
  );

  win.contentView.addChildView(view);
  for (const event of RELAYOUT_ON) win.on(event as "resize", layout);
  win.webContents.on("did-finish-load", raise);
  win.once("closed", onWindowClosed);
  attachedTo = win;
  layout();
  // Not shown if hidden on purpose: it's there when the window comes back.
  // Keys go to the overlay, not to the page behind it.
  if (win.isVisible()) view.webContents.focus();
  return true;
}

export function hideDisconnected(): void {
  if (view && attachedTo && !attachedTo.isDestroyed()) {
    attachedTo.contentView.removeChildView(view);
    for (const event of RELAYOUT_ON) attachedTo.off(event as "resize", layout);
    attachedTo.webContents.off("did-finish-load", raise);
    attachedTo.off("closed", onWindowClosed);
  }
  if (view && !view.webContents.isDestroyed()) view.webContents.close();
  view = null;
  attachedTo = null;
}
