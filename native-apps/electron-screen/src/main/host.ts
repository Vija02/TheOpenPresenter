import { net } from "electron";

import { store } from "./store";
import { getSettingsWin, showScreen } from "./windows";

const POLL_INTERVAL_MS = 5000;
const PROBE_TIMEOUT_MS = 5000;
const DEFAULT_ROOT_URL = "https://theopenpresenter.com";

async function probe(url: string): Promise<boolean> {
  if (!url) return false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    await net.fetch(url, { signal: ctrl.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function checkHost(url: string): Promise<boolean> {
  return probe(url);
}

function storedRootUrl(): string {
  return (store.get<string>("rootUrl") ?? DEFAULT_ROOT_URL) || DEFAULT_ROOT_URL;
}

export function storedRequireHostReachable(): boolean {
  const settings = store.get<{ requireHostReachable?: boolean }>("settings");
  return settings?.requireHostReachable ?? true;
}

export async function waitForHostAndShow(): Promise<void> {
  let attempt = 0;
  while (true) {
    attempt++;
    const rootUrl = storedRootUrl();

    if (await probe(rootUrl)) {
      getSettingsWin()?.webContents.send("host-wait", {
        status: "ready",
        attempt,
        rootUrl,
      });
      showScreen();
      return;
    }

    getSettingsWin()?.webContents.send("host-wait", {
      status: "waiting",
      attempt,
      rootUrl,
    });
    await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}
