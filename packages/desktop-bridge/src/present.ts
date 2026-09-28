import { electronBridge, isTauri, tauriCore, tauriWindow } from "./host";
import type { Monitor } from "./types";

export async function listMonitors(): Promise<Monitor[]> {
  const electron = electronBridge();
  if (electron) {
    const monitors = (await electron.invoke("present:monitors")) as Array<{
      name: string;
      width: number;
      height: number;
    }>;
    return monitors.map((monitor, index) => ({ index, ...monitor }));
  }

  if (isTauri()) {
    const { availableMonitors } = await tauriWindow();
    const monitors = await availableMonitors();
    return monitors.map((monitor, index) => ({
      index,
      name: monitor.name ?? `Display ${index + 1}`,
      width: monitor.size.width,
      height: monitor.size.height,
    }));
  }

  if (typeof window === "undefined") return [];
  return [
    {
      index: 0,
      name: "This screen",
      width: window.screen.width,
      height: window.screen.height,
    },
  ];
}

/** Open the renderer on a specific output */
export async function present(
  url: string,
  monitorIndex = 0,
  rendererId = "1",
): Promise<void> {
  const electron = electronBridge();
  if (electron) {
    await electron.invoke("present:open", { url, monitorIndex, rendererId });
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
