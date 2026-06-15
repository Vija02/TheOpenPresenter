import { screen } from "electron";

import {
  getMainWin,
  getSettingsWin,
  isScreenVisible,
  showScreen,
} from "./windows";

export type MonitorInfo = {
  name: string;
  width: number;
  height: number;
  x: number;
  y: number;
  is_primary: boolean;
};

export function listMonitors(): MonitorInfo[] {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  return displays.map((d) => ({
    name: d.label || String(d.id),
    width: d.bounds.width,
    height: d.bounds.height,
    x: d.bounds.x,
    y: d.bounds.y,
    is_primary: d.id === primary.id,
  }));
}

export async function applyMonitor(monitorName: string): Promise<void> {
  const win = getMainWin();
  if (!win || win.isDestroyed()) return;

  const displays = screen.getAllDisplays();
  const target = displays.find(
    (d) => (d.label || String(d.id)) === monitorName,
  );
  if (!target) throw new Error(`Monitor not found: ${monitorName}`);

  const { x, y, width, height } = target.bounds;

  if (win.isFullScreen()) {
    win.setFullScreen(false);
    await new Promise<void>((r) => setTimeout(r, 150));
  }
  win.setBounds({ x, y, width, height });
  if (win.isVisible()) {
    win.setFullScreen(true);
  }
}

export function setupMonitorWatch(): void {
  screen.on("display-added", onMonitorChange);
  screen.on("display-removed", onMonitorChange);
  screen.on("display-metrics-changed", onMonitorChange);
}

function onMonitorChange(): void {
  getSettingsWin()?.webContents.send("monitors-changed", null);

  // Re-apply fullscreen geometry if the screen window is currently visible
  if (isScreenVisible()) {
    showScreen();
  }
}
