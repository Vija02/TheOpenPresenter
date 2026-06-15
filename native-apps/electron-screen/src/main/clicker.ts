import { net, session } from "electron";
import {
  type ReadStream,
  constants,
  createReadStream,
  openSync,
  readFileSync,
} from "fs";

import { store } from "./store";

// ---------------------------------------------------------------------------
// Presentation clicker -> screenKeyPress bridge (Linux only)
//
// Reads raw evdev events from a USB presentation clicker, grabs the device
// exclusively (so the key presses do NOT leak to the focused kiosk window),
// and forwards each press to the backend `screenKeyPress` GraphQL mutation
// as a PREV / NEXT key press for the screen this app is paired to.
// ---------------------------------------------------------------------------

// Built-in name fragments (matched case-insensitively) that strongly indicate a
// presentation remote.
// Users can add more via the clickerDeviceName (string) or clickerDeviceNames (string[]) store
// keys when their clicker reports something different.
const DEFAULT_DEVICE_PATTERNS = ["present", "wireless presenter"];
const DEFAULT_ROOT_URL = "https://theopenpresenter.com";
const DEVICE_RETRY_MS = 3000;

// --- Linux evdev constants -------------------------------------------------
const EV_KEY = 1;
const INPUT_EVENT_SIZE = 24; // struct input_event on 64-bit Linux
// EVIOCGRAB ioctl: _IOW('E', 0x90, int) = 0x40044590
const EVIOCGRAB = 0x40044590;

// --- Key codes -------------------------------------------------------------
const KEY_UP = 103;
const KEY_PAGEUP = 104;
const KEY_LEFT = 105;
const KEY_RIGHT = 106;
const KEY_DOWN = 108;
const KEY_PAGEDOWN = 109;

const PREV_KEYS = new Set<number>([KEY_PAGEUP, KEY_UP, KEY_LEFT]);
const NEXT_KEYS = new Set<number>([KEY_PAGEDOWN, KEY_DOWN, KEY_RIGHT]);

type KeyPressType = "PREV" | "NEXT";

const KEYPRESS_MUTATION =
  "mutation ScreenKeyPress($input: ScreenKeyPressInput!) { screenKeyPress(input: $input) { success } }";

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let stopped = true;
let patterns: string[] = [];
// One read stream per open event node, keyed by device path. A single clicker
// can expose several event nodes (e.g. a keyboard + a consumer-control
// interface) and there may be more than one clicker — we read them all.
const streams = new Map<string, ReadStream>();
let retryTimer: NodeJS.Timeout | null = null;
let cachedScreenId: string | null = null;

function log(...args: unknown[]): void {
  console.log("[Clicker]", ...args);
}

// ---------------------------------------------------------------------------
// Exclusive grab via libc ioctl (best-effort; koffi is optional)
// ---------------------------------------------------------------------------

let grab: ((fd: number) => boolean) | null = null;

function loadGrab(): void {
  if (grab !== null) return;
  try {
    // Lazy require so a missing/incompatible koffi never crashes the app.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const koffi = require("koffi");
    const libc = koffi.load("libc.so.6");
    const ioctl = libc.func(
      "int ioctl(int fd, unsigned long request, int arg)",
    );
    grab = (fd: number): boolean => {
      try {
        return ioctl(fd, EVIOCGRAB, 1) === 0;
      } catch {
        return false;
      }
    };
  } catch (err) {
    log("koffi unavailable, device will not be grabbed exclusively:", err);
    grab = null;
  }
}

// ---------------------------------------------------------------------------
// Device discovery
// ---------------------------------------------------------------------------

function deviceMatches(name: string, pats: string[]): boolean {
  const lower = name.toLowerCase();
  return pats.some((p) => lower.includes(p.toLowerCase()));
}

/**
 * Return every /dev/input/eventN path belonging to a device whose name matches
 * any of the patterns. Returns ALL event nodes of each match (multi-interface
 * clickers split buttons across nodes), and can match more than one device.
 */
function findDevicePaths(pats: string[]): string[] {
  let content: string;
  try {
    content = readFileSync("/proc/bus/input/devices", "utf8");
  } catch {
    return [];
  }

  const paths: string[] = [];
  for (const block of content.split("\n\n")) {
    if (!block.trim()) continue;
    let n = "";
    let handlers = "";
    for (const line of block.split("\n")) {
      const nameMatch = line.match(/^N: Name="(.+)"$/);
      if (nameMatch) n = nameMatch[1]!;
      const handlersMatch = line.match(/^H: Handlers=(.+)$/);
      if (handlersMatch) handlers = handlersMatch[1]!;
    }
    if (!n || !deviceMatches(n, pats)) continue;
    for (const h of handlers.split(/\s+/)) {
      if (h.startsWith("event")) paths.push(`/dev/input/${h}`);
    }
  }
  return paths;
}

/** Merge the built-in patterns with any user-configured overrides. */
function buildPatterns(): string[] {
  const list = [...DEFAULT_DEVICE_PATTERNS];
  const single = store.get<string>("clickerDeviceName");
  if (single && single.trim()) list.push(single.trim());
  const many = store.get<string[]>("clickerDeviceNames");
  if (Array.isArray(many)) {
    for (const m of many)
      if (typeof m === "string" && m.trim()) list.push(m.trim());
  }
  return list;
}

// ---------------------------------------------------------------------------
// screenId resolution (orgSlug/screenSlug -> UUID via GraphQL)
// ---------------------------------------------------------------------------

function rootUrl(): string {
  return (store.get<string>("rootUrl") ?? DEFAULT_ROOT_URL) || DEFAULT_ROOT_URL;
}

const SCREENS_QUERY =
  "query DesktopScreens { currentUser { id organizationMemberships(first: 20) { nodes { organization { id slug screens(orderBy: [NAME_ASC]) { nodes { id slug } } } } } } }";

async function resolveScreenId(): Promise<string | null> {
  if (cachedScreenId) return cachedScreenId;

  const sel = store.get<{ orgSlug?: string; screenSlug?: string }>("screen");
  if (!sel?.orgSlug || !sel?.screenSlug) return null;

  const base = rootUrl().replace(/\/+$/, "");
  try {
    const resp = await net.fetch(`${base}/graphql`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-top-csrf-protection": "1",
      },
      body: JSON.stringify({ query: SCREENS_QUERY }),
    });
    const parsed = (await resp.json()) as {
      data?: {
        currentUser?: {
          organizationMemberships: {
            nodes: Array<{
              organization?: {
                slug: string;
                screens: { nodes: Array<{ id: string; slug: string }> };
              };
            }>;
          };
        };
      };
    };

    const orgs = parsed.data?.currentUser?.organizationMemberships.nodes ?? [];
    for (const m of orgs) {
      if (m.organization?.slug !== sel.orgSlug) continue;
      const s = m.organization.screens.nodes.find(
        (x) => x.slug === sel.screenSlug,
      );
      if (s) {
        cachedScreenId = s.id;
        return s.id;
      }
    }
  } catch (err) {
    log("failed to resolve screenId:", err);
  }
  return null;
}

/** Drop the cached screenId, e.g. after re-pairing to a different screen. */
export function resetClickerScreen(): void {
  cachedScreenId = null;
}

// ---------------------------------------------------------------------------
// Send a key press to the backend
// ---------------------------------------------------------------------------

async function sendKeyPress(keyType: KeyPressType): Promise<void> {
  // Must be logged in (cookie present) for the mutation to be authorized.
  const cookies = await session.defaultSession.cookies.get({
    url: rootUrl(),
    name: "connect.sid",
  });
  if (cookies.length === 0) {
    log("not logged in, ignoring", keyType);
    return;
  }

  const screenId = await resolveScreenId();
  if (!screenId) {
    log("no screen paired, ignoring", keyType);
    return;
  }

  const base = rootUrl().replace(/\/+$/, "");
  try {
    const resp = await net.fetch(`${base}/graphql`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-top-csrf-protection": "1",
      },
      body: JSON.stringify({
        query: KEYPRESS_MUTATION,
        variables: { input: { keyType, screenId } },
      }),
    });
    const result = (await resp.json()) as {
      data?: { screenKeyPress?: { success: boolean } | null };
      errors?: Array<{ message: string }>;
    };
    if (result.errors?.length) {
      log(
        `${keyType} -> error:`,
        result.errors.map((e) => e.message).join("; "),
      );
    } else {
      log(
        `${keyType} -> success=${result.data?.screenKeyPress?.success ?? false}`,
      );
    }
  } catch (err) {
    log(`${keyType} -> request failed:`, err);
  }
}

function onKeyCode(code: number): void {
  if (PREV_KEYS.has(code)) {
    void sendKeyPress("PREV");
  } else if (NEXT_KEYS.has(code)) {
    void sendKeyPress("NEXT");
  }
}

// ---------------------------------------------------------------------------
// Device open / read loop
// ---------------------------------------------------------------------------

function scheduleRetry(): void {
  if (stopped || retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    openMatching();
  }, DEVICE_RETRY_MS);
}

/** Open every matching event node that isn't already open. */
function openMatching(): void {
  if (stopped) return;

  const paths = findDevicePaths(patterns);
  if (paths.length === 0) {
    scheduleRetry();
    return;
  }

  let missing = false;
  for (const path of paths) {
    if (streams.has(path)) continue;
    if (!openDevice(path)) missing = true;
  }

  // Keep polling while nothing is open yet, or some matched node failed to open
  // (e.g. transient permission error). Once everything is open we stop polling;
  // an unplug fires the stream 'close' handler which reschedules.
  if (streams.size === 0 || missing) scheduleRetry();
}

/** Open and start reading a single event node. Returns true on success. */
function openDevice(path: string): boolean {
  let fd: number;
  try {
    fd = openSync(path, constants.O_RDONLY);
  } catch (err) {
    log(
      `cannot open ${path} (need read access to /dev/input — is the user in the 'input' group?):`,
      err,
    );
    return false;
  }

  if (grab) {
    if (grab(fd)) log(`grabbed device exclusively: ${path}`);
    else
      log(
        `could not grab ${path} exclusively; keys may leak to the focused window`,
      );
  }

  log(`listening on ${path}`);

  // Event-driven, non-blocking read. autoClose closes fd (and releases the
  // grab) when the device is unplugged or errors.
  let buf: Buffer = Buffer.alloc(0);
  const s = createReadStream(path, {
    fd,
    highWaterMark: INPUT_EVENT_SIZE * 16,
  });
  streams.set(path, s);

  s.on("data", (chunk: string | Buffer) => {
    const data: Buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    buf = buf.length ? Buffer.concat([buf, data]) : data;
    while (buf.length >= INPUT_EVENT_SIZE) {
      const type = buf.readUInt16LE(16);
      const code = buf.readUInt16LE(18);
      const value = buf.readInt32LE(20);
      buf = buf.subarray(INPUT_EVENT_SIZE);
      // value: 0 = release, 1 = press, 2 = autorepeat — act on press only
      if (type === EV_KEY && value === 1) onKeyCode(code);
    }
  });

  s.on("error", (err) => {
    log(`stream error on ${path}:`, err);
    streams.delete(path);
    scheduleRetry();
  });

  s.on("close", () => {
    streams.delete(path);
    if (!stopped) {
      log(`device closed (${path}), will retry`);
      scheduleRetry();
    }
  });

  return true;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function startClicker(): void {
  if (process.platform !== "linux") return;
  if (!stopped) return;
  stopped = false;

  patterns = buildPatterns();
  log("matching device name patterns:", patterns.join(", "));

  loadGrab();
  openMatching();
}

export function stopClicker(): void {
  stopped = true;
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  for (const s of streams.values()) s.destroy();
  streams.clear();
}
