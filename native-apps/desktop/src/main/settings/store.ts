import { app } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

import { shellDir } from "./paths";

/** JSON-file settings store */

export type Mode = "cloud" | "selfhosted" | "local";

export type Settings = {
  /** Which mode the user picked at first launch. */
  mode?: Mode;
  /** Server the shell talks to in cloud / self-hosted mode. */
  rootUrl?: string;
  /** Release channel for the local runtime. */
  channel?: string;
  /** Start the local runtime automatically when the app opens. */
  autoStartRuntime?: boolean;
  /** Whether to reopen the iroh tunnel on launch. */
  remoteAccess?: boolean;
  /** Where runtime releases are fetched from. */
  runtimeSource?: string;
  /** Monitor label the presentation window opens on. */
  presentMonitor?: string;
};

export const DEFAULT_CLOUD_URL = "https://theopenpresenter.com";
export const DEFAULT_CHANNEL = "stable";

let cache: Record<string, unknown> | null = null;

function storePath(): string {
  return join(shellDir(), "settings.json");
}

function load(): Record<string, unknown> {
  if (cache) return cache;
  try {
    const path = storePath();
    cache = existsSync(path)
      ? (JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>)
      : {};
  } catch {
    // A corrupt settings file must not stop the app opening: there would be
    // no way to fix it from inside the app.
    cache = {};
  }
  return cache;
}

function persist(): void {
  try {
    const dir = shellDir();
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(storePath(), JSON.stringify(cache ?? {}, null, 2), "utf8");
  } catch (err) {
    console.error("[settings] failed to save:", err);
  }
}

export const store = {
  get<T>(key: string): T | null {
    const data = load();
    return key in data ? (data[key] as T) : null;
  },
  set(key: string, value: unknown): void {
    load();
    cache![key] = value;
    persist();
  },
  delete(key: string): void {
    load();
    delete cache![key];
    persist();
  },
};

export function getSettings(): Settings {
  return store.get<Settings>("settings") ?? {};
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const next = { ...getSettings(), ...patch };
  store.set("settings", next);
  return next;
}

export function clearSettings(): void {
  store.delete("settings");
}

/** Normalise user-typed host input into an origin we can fetch. */
export function normalizeHost(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  // A bare hostname is more likely a LAN box than a public site, but assuming
  // http would silently downgrade theopenpresenter.com.
  const isLocal =
    /^localhost(:\d+)?$/i.test(trimmed) ||
    /^127\.\d+\.\d+\.\d+(:\d+)?$/.test(trimmed) ||
    /^192\.168\./.test(trimmed) ||
    /^10\./.test(trimmed);
  return `${isLocal ? "http" : "https"}://${trimmed}`;
}

export function resolveRuntimeSource(): string | undefined {
  const stored = getSettings().runtimeSource?.trim();
  if (stored) return stored;

  const fromEnv = process.env.TOP_RUNTIME_SOURCE?.trim();
  if (fromEnv) return fromEnv;

  if (!app.isPackaged) {
    const devCdn = join(homedir(), ".theopenpresenter-dev-cdn");
    if (existsSync(devCdn)) return devCdn;
  }

  return undefined;
}

export function resolveRootUrl(localUrl: string | null): string {
  const settings = getSettings();
  if (settings.mode === "local") return localUrl ?? "";
  return settings.rootUrl ?? DEFAULT_CLOUD_URL;
}
