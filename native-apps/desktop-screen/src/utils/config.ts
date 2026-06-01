import { invoke } from "@tauri-apps/api/core";
import { enable as enableAutostartPlugin } from "@tauri-apps/plugin-autostart";
import { type Store, load } from "@tauri-apps/plugin-store";

const STORE_FILE = "config.json";

const KEY_ROOT_URL = "rootUrl";
const KEY_SCREEN = "screen";
const KEY_SETTINGS = "settings";

export const DEFAULT_ROOT_URL = "https://theopenpresenter.com";

let storePromise: Promise<Store> | null = null;
const getStore = (): Promise<Store> => {
  if (!storePromise) {
    storePromise = load(STORE_FILE, { autoSave: false, defaults: {} });
  }
  return storePromise;
};

// ---------------------------------------------------------------------------
// Host / root URL
// ---------------------------------------------------------------------------

let cachedRootUrl: string = DEFAULT_ROOT_URL;

export const normalizeHost = (raw: string): string => {
  let s = (raw ?? "").trim();
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  return s.replace(/\/+$/, "");
};

export const initRootUrl = async (): Promise<string> => {
  try {
    const store = await getStore();
    const stored = await store.get<string>(KEY_ROOT_URL);
    cachedRootUrl = (stored && stored.trim()) || DEFAULT_ROOT_URL;
  } catch {
    cachedRootUrl = DEFAULT_ROOT_URL;
  }
  return cachedRootUrl;
};

export const getRootUrl = (): string => cachedRootUrl;

export const setRootUrl = async (raw: string): Promise<string> => {
  const normalized = normalizeHost(raw);
  cachedRootUrl = normalized;
  const store = await getStore();
  await store.set(KEY_ROOT_URL, normalized);
  await store.save();
  return normalized;
};

// ---------------------------------------------------------------------------
// Selected screen
// ---------------------------------------------------------------------------

export type Screen = {
  orgSlug: string;
  screenSlug: string;
  /** Optional human-readable labels */
  orgName?: string;
  screenName?: string;
};

export const getScreen = async (): Promise<Screen | null> => {
  try {
    const store = await getStore();
    const raw = (await store.get<Screen>(KEY_SCREEN)) ?? null;
    if (!raw || !raw.orgSlug || !raw.screenSlug) return null;
    return {
      orgSlug: raw.orgSlug,
      screenSlug: raw.screenSlug,
      orgName: raw.orgName,
      screenName: raw.screenName,
    };
  } catch {
    return null;
  }
};

export const setScreen = async (screen: Screen): Promise<void> => {
  const store = await getStore();
  await store.set(KEY_SCREEN, screen);
  await store.save();
};

export const clearScreen = async (): Promise<void> => {
  const store = await getStore();
  await store.delete(KEY_SCREEN);
  await store.save();
};

// ---------------------------------------------------------------------------
// Local settings
//
// NOTE: `autostart` is mirrored here for convenience, but the OS plugin
// (`@tauri-apps/plugin-autostart`) is the authoritative source
// ---------------------------------------------------------------------------

export type SettingsValues = {
  monitor: string;
  autostart: boolean;
  requireHostReachable: boolean;
};

export const DEFAULT_SETTINGS: SettingsValues = {
  monitor: "current",
  autostart: false,
  requireHostReachable: true,
};

export const getSettings = async (): Promise<SettingsValues> => {
  try {
    const store = await getStore();
    const stored =
      (await store.get<Partial<SettingsValues>>(KEY_SETTINGS)) ?? {};
    return { ...DEFAULT_SETTINGS, ...stored };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
};

export const setSettings = async (values: SettingsValues): Promise<void> => {
  const store = await getStore();
  await store.set(KEY_SETTINGS, values);
  await store.save();
};

export const initAutostart = async (): Promise<void> => {
  if (import.meta.env.DEV) return;
  try {
    const store = await getStore();
    const stored =
      (await store.get<Partial<SettingsValues>>(KEY_SETTINGS)) ?? {};
    if (stored.autostart !== undefined) return; // not a fresh install
    await enableAutostartPlugin().catch(() => {});
    const merged: SettingsValues = {
      ...DEFAULT_SETTINGS,
      ...stored,
      autostart: true,
    };
    await store.set(KEY_SETTINGS, merged);
    await store.save();
  } catch {}
};

export const initMonitor = async (): Promise<void> => {
  if (import.meta.env.DEV) return;
  try {
    const settings = await getSettings();
    if (settings.monitor && settings.monitor !== "current") {
      await invoke("apply_monitor", { monitorName: settings.monitor });
    }
  } catch {
    // Best-effort; the user can re-pick the monitor in Settings.
  }
};

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const logout = async (): Promise<void> => {
  await clearScreen();
  await invoke("clear_session", { rootUrl: getRootUrl() }).catch(() => {});
};
