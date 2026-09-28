import type { DesktopHost, ElectronBridge } from "./types";

function electronBridge(): ElectronBridge | null {
  if (typeof window === "undefined") return null;
  return window.theOpenPresenterDesktop ?? null;
}

function isTauri(): boolean {
  return typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;
}

export function detectHost(): DesktopHost {
  if (electronBridge()) return "electron";
  if (isTauri()) return "tauri";
  return "browser";
}

/**
 * Tauri's API is imported lazily so a browser or Electron bundle never
 * evaluates it. A static import would pull the whole module in and, worse,
 * throw on access in a non-Tauri context.
 *
 * The return types are spelled out rather than inferred. An inferred
 * `typeof import("@tauri-apps/api")` crosses a module boundary into the
 * generated typings, where tsup's dts rollup rewrites it as a named import
 * that does not exist (`tauriAppsApiCore`), breaking every consumer's
 * typecheck. Naming only the members used keeps Tauri's types out of the
 * public surface entirely.
 */
type TauriCore = {
  invoke<T = unknown>(cmd: string, args?: unknown): Promise<T>;
};

type TauriWindowHandle = {
  label: string;
  close(): Promise<void>;
};

type TauriWindowApi = {
  availableMonitors(): Promise<
    { name: string | null; size: { width: number; height: number } }[]
  >;
  getAllWindows(): Promise<TauriWindowHandle[]>;
  getCurrentWindow(): TauriWindowHandle;
};

async function tauriCore(): Promise<TauriCore> {
  const { core } = await import("@tauri-apps/api");
  return core as TauriCore;
}

async function tauriWindow(): Promise<TauriWindowApi> {
  return (await import("@tauri-apps/api/window")) as unknown as TauriWindowApi;
}

export { electronBridge, isTauri, tauriCore, tauriWindow };
