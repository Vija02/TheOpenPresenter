import { runtime } from "../runtime/client";
import { logShell } from "../shell/log";
import { refetchServerWindows } from "../shell/windows";
import { allOrganizations, localSessionHeader } from "./connection";

/**
 * Refreshes the dashboard when sync adds, changes or deletes projects, by
 * subscribing to the local server's `cloudOrganizationChanged` per synced org.
 */

const RETRY_MS = 5_000;
// Sync sends one hint per row: wait for a lull, but not forever.
const QUIET_MS = 500;
const MAX_WAIT_MS = 3_000;

let socket: WebSocket | null = null;
// Drops a connect that a newer restart overtook.
let generation = 0;
let retry: ReturnType<typeof setTimeout> | undefined;
let quiet: ReturnType<typeof setTimeout> | undefined;
let firstHint: number | null = null;

function scheduleRefetch(base: string): void {
  const now = Date.now();
  firstHint ??= now;
  clearTimeout(quiet);
  const wait = Math.min(QUIET_MS, firstHint + MAX_WAIT_MS - now);
  quiet = setTimeout(() => {
    firstHint = null;
    refetchServerWindows(base);
  }, wait);
}

async function connect(base: string, current: number): Promise<void> {
  const slugs = (await allOrganizations(base))
    .filter((org) => org.cloudConnectionId)
    .map((org) => org.slug);
  const headers = await localSessionHeader(base);
  if (current !== generation || slugs.length === 0) return;

  // Node's WebSocket takes headers, which the browser one doesn't.
  const ws = new WebSocket(`${base.replace(/^http/, "ws")}/graphql`, {
    protocols: "graphql-transport-ws",
    headers,
  } as unknown as string);
  socket = ws;

  ws.onopen = () => ws.send(JSON.stringify({ type: "connection_init" }));
  ws.onmessage = (event) => {
    const message = JSON.parse(String(event.data));
    if (message.type === "connection_ack") {
      slugs.forEach((slug, i) =>
        ws.send(
          JSON.stringify({
            id: String(i),
            type: "subscribe",
            payload: {
              query: `subscription ($slug: String!) {
                cloudOrganizationChanged(organizationSlug: $slug) { entity }
              }`,
              variables: { slug },
            },
          }),
        ),
      );
    } else if (message.type === "ping") {
      ws.send(JSON.stringify({ type: "pong" }));
    } else if (
      message.type === "next" &&
      message.payload?.data?.cloudOrganizationChanged?.entity ===
        "app_public.projects"
    ) {
      scheduleRefetch(base);
    }
  };
  ws.onclose = () => {
    if (socket !== ws) return;
    socket = null;
    retry = setTimeout(() => void restartLiveRefresh(), RETRY_MS);
  };
}

/** (Re)subscribe against the current server, e.g. after orgs change. */
export async function restartLiveRefresh(): Promise<void> {
  clearTimeout(retry);
  const current = ++generation;
  const previous = socket;
  socket = null;
  previous?.close();

  const base = runtime.url;
  if (!base) return;
  try {
    await connect(base, current);
  } catch (err) {
    logShell("warn", "[live-refresh] could not subscribe", err);
    if (current !== generation) return;
    retry = setTimeout(() => void restartLiveRefresh(), RETRY_MS);
  }
}

export function startLiveRefresh(): void {
  runtime.on("listening", () => void restartLiveRefresh());
  runtime.on("runtime-restarted", () => void restartLiveRefresh());
}
