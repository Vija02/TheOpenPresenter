import { electronBridge, isTauri, tauriCore } from "./host";

/** Open a URL in the user's real browser rather than inside the shell. */
export async function openExternal(url: string): Promise<void> {
  const electron = electronBridge();
  if (electron) {
    await electron.invoke("app:open-external", url);
    return;
  }

  if (isTauri() && window.__TAURI__?.opener) {
    await window.__TAURI__.opener.openUrl(url);
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

/** The machine's LAN address, for the share QR code */
export async function localIp(): Promise<string | null> {
  const electron = electronBridge();
  if (electron) {
    return ((await electron.invoke("host:local-address")) as string) ?? null;
  }

  if (isTauri()) {
    const core = await tauriCore();
    return (await core.invoke<string | null>("get_local_ip")) ?? null;
  }

  return null;
}
