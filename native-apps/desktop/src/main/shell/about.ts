import { app } from "electron";

import { runtime } from "../runtime/client";
import { getSettings } from "../settings/store";

/** Where people go looking for us. */
export const WEBSITE_URL = "https://theopenpresenter.com";

export type AboutInfo = {
  appVersion: string;
  runtimeVersion: string | null;
  runtimeRunning: boolean;
  managerVersion: string | null;
  electron: string;
  node: string;
  chrome: string;
  connection: string;
  mode: string;
};

export async function aboutInfo(): Promise<AboutInfo> {
  const settings = getSettings();

  let runtimeVersion: string | null = null;
  let managerVersion: string | null = null;
  let runtimeRunning = false;

  try {
    const status = (await runtime.status()) as {
      current?: string | null;
      managerVersion?: string;
      running?: boolean;
    };
    runtimeVersion = status.current ?? null;
    managerVersion = status.managerVersion ?? null;
    runtimeRunning = status.running === true || runtime.url != null;
  } catch {
    // An unreachable manager is itself worth reporting, so fall through with
    // nulls rather than failing to open the page.
  }

  const connection =
    settings.mode === "local"
      ? (runtime.url ?? "Not running")
      : (settings.rootUrl ?? "Not connected");

  return {
    appVersion: app.getVersion(),
    runtimeVersion,
    runtimeRunning,
    managerVersion,
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome,
    connection,
    mode: settings.mode === "local" ? "This computer" : "Remote server",
  };
}
