import { electronAPI } from "./electronAPI";

export type Store = {
  get: <T>(key: string) => Promise<T | null>;
  set: (key: string, value: unknown) => Promise<void>;
  delete: (key: string) => Promise<void>;
  save: () => Promise<void>;
};

/**
 * Open the persistent key/value store. All state is forwarded via IPC to the
 * main-process JSON store (see src/main/store.ts). The filename/options args
 * are accepted for call-site compatibility but ignored.
 */
export const load = async (
  _filename?: string,
  _opts?: unknown,
): Promise<Store> => ({
  get: <T>(key: string) => electronAPI.invoke<T | null>("store:get", { key }),
  set: (key: string, value: unknown) =>
    electronAPI.invoke<void>("store:set", { key, value }),
  delete: (key: string) => electronAPI.invoke<void>("store:delete", { key }),
  // The main-process store writes on every set/delete, so save() is a no-op.
  save: () => Promise.resolve(),
});
