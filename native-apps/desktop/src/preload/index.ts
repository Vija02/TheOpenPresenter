import { contextBridge, ipcRenderer } from "electron";

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

  // -- Shell ----------------------------------------------------------------
  openExternal: (url: string) => ipcRenderer.invoke("app:open-external", url),
  backToShell: () => ipcRenderer.invoke("app:back-to-shell"),
};

contextBridge.exposeInMainWorld("theOpenPresenterDesktop", api);

export type DesktopApi = typeof api;
