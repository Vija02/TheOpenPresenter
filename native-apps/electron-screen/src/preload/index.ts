import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  invoke: (channel: string, args?: Record<string, unknown>): Promise<unknown> =>
    ipcRenderer.invoke(channel, args),

  listen: (
    event: string,
    handler: (payload: unknown) => void,
  ): (() => void) => {
    const listener = (_: Electron.IpcRendererEvent, payload: unknown) =>
      handler(payload);
    ipcRenderer.on(event, listener);
    return () => ipcRenderer.removeListener(event, listener);
  },
});
