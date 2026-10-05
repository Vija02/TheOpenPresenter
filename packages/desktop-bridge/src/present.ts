import { electronBridge, isTauri, tauriCore, tauriWindow } from "./host";
import type { Monitor } from "./types";

const TAURI_POLL_MS = 2000;

export async function listMonitors(): Promise<Monitor[]> {
  const electron = electronBridge();
  if (electron) {
    const monitors = (await electron.invoke("present:monitors")) as Array<{
      id?: string;
      name: string;
      width: number;
      height: number;
      x?: number;
      y?: number;
      isPrimary?: boolean;
      isCurrent?: boolean;
    }>;
    return monitors.map((monitor, index) => ({
      ...monitor,
      index,
      x: monitor.x ?? sumWidths(monitors.slice(0, index)),
      y: monitor.y ?? 0,
    }));
  }

  if (isTauri()) {
    const { availableMonitors, currentMonitor, primaryMonitor } =
      await tauriWindow();
    const [monitors, current, primary] = await Promise.all([
      availableMonitors(),
      currentMonitor().catch(() => null),
      primaryMonitor().catch(() => null),
    ]);
    const same = (
      a: (typeof monitors)[number],
      b: (typeof monitors)[number] | null,
    ) =>
      !!b &&
      a.name === b.name &&
      a.position.x === b.position.x &&
      a.position.y === b.position.y;

    return monitors.map((monitor, index) => ({
      index,
      name: monitor.name ?? `Display ${index + 1}`,
      width: monitor.size.width,
      height: monitor.size.height,
      x: monitor.position.x,
      y: monitor.position.y,
      isPrimary: same(monitor, primary),
      isCurrent: same(monitor, current),
    }));
  }

  if (typeof window === "undefined") return [];
  return [
    {
      index: 0,
      name: "This screen",
      width: window.screen.width,
      height: window.screen.height,
      x: 0,
      y: 0,
      isPrimary: true,
      isCurrent: true,
    },
  ];
}

function sumWidths(monitors: { width: number }[]): number {
  return monitors.reduce((total, monitor) => total + monitor.width, 0);
}

export function onMonitorsChanged(handler: () => void): () => void {
  const electron = electronBridge();
  if (electron) {
    return electron.on("present-monitors-changed", () => handler());
  }

  if (isTauri()) {
    let last: string | null = null;
    const check = async () => {
      const snapshot = JSON.stringify(await listMonitors().catch(() => []));
      if (last !== null && snapshot !== last) handler();
      last = snapshot;
    };
    void check();
    const timer = setInterval(check, TAURI_POLL_MS);
    return () => clearInterval(timer);
  }

  return () => {};
}

/** Open the renderer on a specific output */
export async function present(
  url: string,
  monitorIndex = 0,
  rendererId = "1",
  monitorId?: string,
): Promise<void> {
  const electron = electronBridge();
  if (electron) {
    await electron.invoke("present:open", {
      url,
      monitorIndex,
      monitorId,
      rendererId,
    });
    return;
  }

  if (isTauri()) {
    const core = await tauriCore();
    await core.invoke("open_renderer", { url, mindex: monitorIndex });
    return;
  }

  window.open(url, `top-renderer-${rendererId}`, "popup=true");
}

export async function stopPresenting(rendererId = "1"): Promise<void> {
  const electron = electronBridge();
  if (electron) {
    await electron.invoke("present:close", rendererId);
    return;
  }

  if (isTauri()) {
    const { getAllWindows } = await tauriWindow();
    const windows = await getAllWindows();
    const renderer = windows.find((w) => w.label === "renderer");
    await renderer?.close();
    return;
  }

  if (document.fullscreenElement) {
    await document.exitFullscreen().catch(() => {});
  }
}

/** Renderer ids currently presenting. Empty in a browser. */
export async function listPresenting(): Promise<string[]> {
  const electron = electronBridge();
  if (electron) {
    return (await electron.invoke("present:list")) as string[];
  }

  if (isTauri()) {
    const { getAllWindows } = await tauriWindow();
    const windows = await getAllWindows();
    return windows.filter((w) => w.label === "renderer").map(() => "1");
  }

  return [];
}

export function onPresentingChanged(
  handler: (rendererIds: string[]) => void,
): () => void {
  const electron = electronBridge();
  if (electron) {
    return electron.on("present-windows-changed", (payload) =>
      handler(Array.isArray(payload) ? (payload as string[]) : []),
    );
  }

  if (isTauri()) {
    let last: string | null = null;
    const check = async () => {
      const ids = await listPresenting().catch(() => []);
      const snapshot = JSON.stringify(ids);
      if (last !== null && snapshot !== last) handler(ids);
      last = snapshot;
    };
    void check();
    const timer = setInterval(check, TAURI_POLL_MS);
    return () => clearInterval(timer);
  }

  return () => {};
}

/** Close the current presentation window from inside it (Escape). */
export async function closeSelf(): Promise<void> {
  if (isTauri()) {
    const { getCurrentWindow } = await tauriWindow();
    await getCurrentWindow().close();
    return;
  }
  // The Electron shell registers Escape in the main process, so the
  // renderer has nothing to do.
}
