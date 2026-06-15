import { electronAPI } from "./electronAPI";

export const enable = (): Promise<void> =>
  electronAPI.invoke("autostart:enable");

export const disable = (): Promise<void> =>
  electronAPI.invoke("autostart:disable");

export const isEnabled = (): Promise<boolean> =>
  electronAPI.invoke("autostart:isEnabled");
