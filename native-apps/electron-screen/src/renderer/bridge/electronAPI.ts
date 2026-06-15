// Typed accessor for the bridge exposed by the preload script
// (see src/preload/index.ts -> contextBridge.exposeInMainWorld).
// This is the single place that touches the global `window.electronAPI`.

export interface ElectronAPI {
  invoke: <T = unknown>(channel: string, args?: unknown) => Promise<T>;
  listen: <T = unknown>(
    event: string,
    handler: (payload: T) => void,
  ) => () => void;
}

export const electronAPI: ElectronAPI = (
  window as unknown as { electronAPI: ElectronAPI }
).electronAPI;
