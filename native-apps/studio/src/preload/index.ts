import { contextBridge, ipcRenderer, webUtils } from "electron";

/**
 * The API exposed to both the shell's own UI and the web app once the window
 * navigates to the server. `theOpenPresenterDesktop` is deliberately
 * shell-agnostic: the web code branches on capability, not on which shell it
 * is running inside.
 */
const api = {
  isDesktop: true,
  shell: "electron" as const,
  platform: process.platform,

  invoke: (channel: string, args?: unknown): Promise<unknown> =>
    ipcRenderer.invoke(channel, args),

  on: (channel: string, handler: (payload: unknown) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown) =>
      handler(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },

  // -- Presentation ---------------------------------------------------------
  listMonitors: () => ipcRenderer.invoke("present:monitors"),
  present: (url: string, monitorIndex: number, rendererId?: string) =>
    ipcRenderer.invoke("present:open", { url, monitorIndex, rendererId }),
  stopPresenting: (rendererId?: string) =>
    ipcRenderer.invoke("present:close", rendererId),
  listPresentWindows: () => ipcRenderer.invoke("present:list"),

  // -- Files ----------------------------------------------------------------
  /** Where a dropped or picked file is on disk; "" if it isn't a real file */
  getPathForFile: (file: File) => {
    const filePath = webUtils.getPathForFile(file);
    if (filePath) ipcRenderer.send("linked-files:allow", filePath);
    return filePath;
  },
  /** This install's iroh endpoint id */
  nodeId: () => ipcRenderer.invoke("app:node-id") as Promise<string | null>,
  /** "linked-files:changed" fires with the path after each save */
  watchLinkedFiles: (filePaths: string[]) =>
    ipcRenderer.invoke("linked-files:watch", filePaths) as Promise<string[]>,
  readLinkedFile: (filePath: string) =>
    ipcRenderer.invoke("linked-files:read", filePath) as Promise<Uint8Array>,

  // -- Shell ----------------------------------------------------------------
  openExternal: (url: string) => ipcRenderer.invoke("app:open-external", url),
  backToShell: () => ipcRenderer.invoke("app:back-to-shell"),
};

contextBridge.exposeInMainWorld("theOpenPresenterDesktop", api);

export type DesktopApi = typeof api;
