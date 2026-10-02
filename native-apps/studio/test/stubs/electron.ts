import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

/**
 * Minimal stand-in for the parts of `electron` the main-process modules touch
 * at import time, so their logic can be tested without launching Electron.
 */

const userData = mkdtempSync(join(tmpdir(), "top-desktop-test-"));

export const app = {
  isPackaged: false,
  getPath: (name: string) => (name === "userData" ? userData : userData),
  getName: () => "TheOpenPresenter",
  getVersion: () => "0.0.0-test",
  setAppUserModelId: () => {},
  on: () => {},
  whenReady: () => Promise.resolve(),
  requestSingleInstanceLock: () => true,
  quit: () => {},
  commandLine: { appendSwitch: () => {} },
};

export const ipcMain = {
  handle: () => {},
};

export const shell = {
  openExternal: () => Promise.resolve(),
};

export const net = {
  fetch: () => Promise.reject(new Error("net.fetch is not stubbed")),
};

export const session = {
  defaultSession: {
    cookies: {
      get: (_filter?: unknown): Promise<{ name: string; value: string }[]> =>
        Promise.resolve([]),
      remove: () => Promise.resolve(),
    },
  },
};

export const screen = {
  getAllDisplays: () => [],
  getPrimaryDisplay: () => ({
    id: 0,
    bounds: { x: 0, y: 0, width: 0, height: 0 },
  }),
  on: () => {},
};

export class BrowserWindow {}
export class Tray {}
export const Menu = { buildFromTemplate: () => ({}) };
export const nativeImage = {
  createFromPath: () => ({ isEmpty: () => true, resize: () => ({}) }),
  createEmpty: () => ({}),
};
export const globalShortcut = { register: () => {}, unregister: () => {} };
export const contextBridge = { exposeInMainWorld: () => {} };
export const ipcRenderer = {
  invoke: () => Promise.resolve(),
  on: () => {},
  removeListener: () => {},
};
