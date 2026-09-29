import { runtime } from "../runtime/client";

/** Local server requests skip CSRF the same way the app's own clients do. */
const HEADERS = {
  "Content-Type": "application/json",
  "x-top-csrf-protection": "1",
};

export async function registerTicket(
  ticket: string,
  endpointId: string,
): Promise<void> {
  if (!runtime.url) {
    throw new Error("The local server is not running.");
  }

  console.log("[remote] registering ticket with the local server…");

  const response = await fetch(`${runtime.url}/device/host/init`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ irohEndpointId: endpointId, irohTicket: ticket }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const message =
      `The server refused the connection details (${response.status}). ${detail}`.trim();
    console.error("[remote]", message);
    throw new Error(message);
  }

  console.log(`[remote] registered, node ${endpointId.slice(0, 12)}…`);
}
