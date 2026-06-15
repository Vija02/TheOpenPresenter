import { net } from "electron";

import { getSettingsWin } from "./windows";

let pairingAbort: AbortController | null = null;

export function startPairing(rootUrl: string): void {
  stopPairing();

  const url = `${rootUrl.replace(/\/+$/, "")}/qr-auth/request`;
  pairingAbort = new AbortController();
  const { signal } = pairingAbort;

  sseLoop(url, signal).catch((err) => {
    if (signal.aborted) return;
    getSettingsWin()?.webContents.send("pairing-error", String(err));
  });
}

export function stopPairing(): void {
  pairingAbort?.abort();
  pairingAbort = null;
}

async function sseLoop(url: string, signal: AbortSignal): Promise<void> {
  const response = await net.fetch(url, {
    headers: { Accept: "text/event-stream" },
    signal,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from SSE endpoint`);
  }
  if (!response.body) {
    throw new Error("No response body for SSE stream");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buf += decoder.decode(value, { stream: true });

    // Process complete SSE blocks (separated by double newline)
    while (true) {
      const idx = buf.indexOf("\n\n");
      if (idx === -1) break;
      const block = buf.slice(0, idx + 2);
      buf = buf.slice(idx + 2);

      for (const line of block.split("\n")) {
        if (line.startsWith("data:")) {
          const payload = line.slice(5).trim();
          if (payload) {
            getSettingsWin()?.webContents.send("pairing-message", payload);
          }
        }
      }
    }
  }
}
